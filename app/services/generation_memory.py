"""Diagnose memory failures and release resources after model frames unwind."""
from functools import wraps
from datetime import datetime
import gc
import os
from pathlib import Path
import sys
import traceback


def classify_memory_error(error):
    """Only identify RAM/VRAM when the allocator message identifies it.

    A generic CUDA driver OOM can surface asynchronously, and does not tell
    us whether device memory, pinned host memory, or another allocation failed.
    """
    message = str(error).lower()
    if "cuda error: out of memory" in message:
        return "CUDA"
    if "cuda out of memory" in message:
        return "VRAM"
    if isinstance(error, MemoryError) or (
        "defaultcpuallocator" in message and "allocate" in message
    ):
        return "RAM"
    return ""


def log_generation_memory(cuda):
    """Best-effort readings before teardown; never initialize CUDA or mask OOM."""
    parts = []
    gib = 1024 ** 3
    try:
        import psutil

        ram = psutil.virtual_memory()
        process = psutil.Process().memory_info()
        parts.extend([
            f"system RAM available {ram.available / gib:.2f}/{ram.total / gib:.2f} GiB",
            f"process RSS {process.rss / gib:.2f} GiB",
        ])
        # psutil exposes Windows private committed bytes separately from RSS.
        if hasattr(process, "private"):
            parts.append(f"process private commit {process.private / gib:.2f} GiB")
    except Exception as error:
        parts.append(f"RAM readings unavailable ({type(error).__name__})")
    try:
        if cuda.is_initialized():
            parts.extend([
                f"PyTorch VRAM allocated {cuda.memory_allocated() / gib:.2f} GiB",
                f"reserved {cuda.memory_reserved() / gib:.2f} GiB",
            ])
            free, total = cuda.mem_get_info()
            parts.append(f"CUDA free {free / gib:.2f}/{total / gib:.2f} GiB")
    except Exception as error:
        parts.append(f"CUDA readings incomplete ({type(error).__name__})")
    print("[Memory at failure, before cleanup] " + "; ".join(parts))


# XPU: Save enough context to diagnose a Level Zero failure on the next restart.
def write_xpu_failure_report(error, traceback_text, model, device, torch_version):
    """Persist the original Level Zero failure without querying the XPU again."""
    try:
        root = Path(__file__).resolve().parents[2]
        log_dir = root / "logs" / "xpu"
        log_dir.mkdir(parents=True, exist_ok=True)
        timestamp = datetime.now().astimezone().strftime("%Y%m%d-%H%M%S")
        report_path = log_dir / f"failure-{timestamp}-{os.getpid()}.log"
        env_names = (
            "MAESTRO_DEVICE",
            "MAESTRO_XPU_MEMORY_FRACTION",
            "MAESTRO_XPU_IMMEDIATE_COMMANDLISTS",
            "ONEAPI_DEVICE_SELECTOR",
            "SYCL_CACHE_PERSISTENT",
            "PYTORCH_ENABLE_XPU_FALLBACK",
            "SYCL_PI_LEVEL_ZERO_USE_IMMEDIATE_COMMANDLISTS",
            "NEO_LOCAL_MEMORY_ALLOCATION_MODE",
            "SYCL_LAUNCH_BLOCKING",
            "SYCL_UR_TRACE",
        )
        environment = "\n".join(
            f"{name}={os.environ.get(name, '<unset>')}" for name in env_names
        )
        try:
            import psutil

            memory = psutil.virtual_memory()
            process = psutil.Process().memory_info()
            ram_summary = (
                f"system_ram_used_gib={memory.used / 1024**3:.2f}/"
                f"{memory.total / 1024**3:.2f}\n"
                f"system_ram_available_gib={memory.available / 1024**3:.2f}\n"
                f"process_rss_gib={process.rss / 1024**3:.2f}"
            )
        except Exception as memory_error:
            ram_summary = f"RAM readings unavailable: {memory_error}"

        report_path.write_text(
            "Maestro Intel XPU failure report\n"
            f"time={datetime.now().astimezone().isoformat()}\n"
            f"model={model}\n"
            f"device={device}\n"
            f"torch={torch_version}\n"
            "XPU allocator/device statistics were intentionally not queried after "
            "the Level Zero failure.\n\n"
            f"{ram_summary}\n\n"
            f"Environment:\n{environment}\n\n"
            f"Error:\n{type(error).__name__}: {error}\n\n"
            f"Traceback:\n{traceback_text}",
            encoding="utf-8",
        )
        return str(report_path)
    except Exception as report_error:
        print(f"[XPU] Could not write failure report: {report_error}")
        return None


def cleanup_failed_generation(cleanup):
    """Keep successful model caching, but tear down after a failed call.

    GPU activations held by a traceback are live allocations: empty_cache()
    inside the model's except block cannot release them.
    """
    def decorate(function):
        @wraps(function)
        def wrapped(*args, **kwargs):
            failed = False
            try:
                result = function(*args, **kwargs)
                failed = result is False
                return result
            except BaseException as error:
                failed = True
                traceback.clear_frames(error.__traceback__)
                raise
            finally:
                if failed:
                    try:
                        cleanup()
                    except Exception as cleanup_error:
                        print(f"[Memory] Failed-generation cleanup: {cleanup_error}")
        return wrapped
    return decorate


def release_auxiliary_models():
    """Release loaded post-processors without importing unused model stacks."""
    from shared.utils import offload_registry

    released = []
    for name in offload_registry.registered_names():
        try:
            released.extend(offload_registry.release_all([name]))
        except Exception as error:
            print(f"[Memory] Could not release {name}: {error}")
    # FlashVSR also needs teardown after a load failure before offload.profile
    # exists. Older in-process instances were not registered at all.
    module = sys.modules.get("postprocessing.flashvsr.runtime")
    runtime = getattr(module, "_RUNTIME", None)
    if runtime is not None and any(getattr(runtime, field, None) is not None for field in ("dit", "lq_proj", "tcdecoder", "vae", "offloadobj")):
        try:
            module.release_models()
            released.append("FlashVSR")
        except Exception as error:
            print(f"[Memory] Could not release FlashVSR: {error}")
    gc.collect()
    return released
