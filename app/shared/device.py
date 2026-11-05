"""Device selection shared by Maestro's runtime and diagnostics."""
from __future__ import annotations

import os
import threading
from typing import Any

import torch


_XPU_RUNTIME_UNSAFE = False
_XPU_SYNC_TIMEOUT_SECONDS = 30
_XPU_ALLOCATOR_CONFIGURED = False


def _configure_xpu_memory_fraction() -> None:
    """Leave allocator headroom so Level Zero can bind/rebind device buffers."""
    global _XPU_ALLOCATOR_CONFIGURED
    if _XPU_ALLOCATOR_CONFIGURED:
        return
    _XPU_ALLOCATOR_CONFIGURED = True
    raw_fraction = os.environ.get("MAESTRO_XPU_MEMORY_FRACTION", "0.90")
    try:
        fraction = float(raw_fraction)
        if not 0.0 < fraction <= 1.0:
            raise ValueError("must be greater than 0 and at most 1")
        torch.xpu.set_per_process_memory_fraction(fraction, device=0)
    except Exception as error:
        print(
            "[XPU] Could not set the per-process memory limit "
            f"({raw_fraction!r}): {error}"
        )
        return
    print(f"[XPU] PyTorch allocator limit set to {fraction:.0%} of device memory.")


def mark_xpu_runtime_unsafe() -> None:
    """Prevent later cache operations from re-entering an unresponsive XPU driver."""
    global _XPU_RUNTIME_UNSAFE
    _XPU_RUNTIME_UNSAFE = True


def xpu_runtime_unsafe() -> bool:
    return _XPU_RUNTIME_UNSAFE


def is_xpu_runtime_failure(error: BaseException) -> bool:
    """Identify Level Zero failures that can leave the XPU context unusable."""
    message = str(error).lower()
    return any(
        marker in message
        for marker in (
            "level_zero backend failed",
            "ur_result_error_out_of_resources",
            "ur_result_error_out_of_device_memory",
            "ur_result_error_device_lost",
            "ur_result_error_unknown",
            "pi_error_device_not_available",
        )
    )


def resolve_device() -> torch.device:
    """Resolve the requested accelerator, preferring CUDA, XPU, then MPS."""
    requested = os.environ.get("MAESTRO_DEVICE", "").strip().lower()
    available = {
        "cuda": bool(torch.cuda.is_available()),
        "xpu": bool(hasattr(torch, "xpu") and torch.xpu.is_available()),
        "mps": bool(hasattr(torch.backends, "mps") and torch.backends.mps.is_available()),
    }
    # XPU: NVIDIA remains the default whenever CUDA is available. The override
    # only selects XPU on machines without an available CUDA device.
    if available["cuda"]:
        return torch.device("cuda")
    if requested == "xpu" and available["xpu"]:
        _configure_xpu_memory_fraction()
        return torch.device("xpu")
    if requested in available and not available[requested]:
        raise RuntimeError(
            f"MAESTRO_DEVICE={requested} was requested, but that PyTorch device is unavailable."
        )
    for name in ("xpu", "mps"):
        if available[name]:
            if name == "xpu":
                _configure_xpu_memory_fraction()
            return torch.device(name)
    return torch.device("cpu")


def device_backend(device: torch.device | str | None = None) -> Any:
    """Return the matching torch device module for cache and sync operations."""
    selected = torch.device(device) if device is not None else resolve_device()
    if selected.type == "cuda":
        return torch.cuda
    if selected.type == "xpu":
        return torch.xpu
    if selected.type == "mps":
        return torch.mps
    return None


def autocast_dtype(device: torch.device | str | None = None) -> torch.dtype:
    """Choose a conservative mixed-precision dtype for the selected device."""
    selected = torch.device(device) if device is not None else resolve_device()
    if selected.type == "xpu" and hasattr(torch, "xpu"):
        return torch.bfloat16
    if selected.type == "cuda":
        try:
            return torch.bfloat16 if torch.cuda.is_bf16_supported() else torch.float16
        except (AttributeError, RuntimeError):
            return torch.float16
    return torch.float32


def empty_cache(device: torch.device | str | None = None) -> None:
    selected = torch.device(device) if device is not None else resolve_device()
    if selected.type == "xpu" and _XPU_RUNTIME_UNSAFE:
        return
    backend = device_backend(device)
    if backend is not None and hasattr(backend, "empty_cache"):
        backend.empty_cache()


def synchronize(device: torch.device | str | None = None) -> None:
    selected = torch.device(device) if device is not None else resolve_device()
    backend = device_backend(device)
    if backend is not None:
        if selected.type != "xpu":
            backend.synchronize()
            return
        if _XPU_RUNTIME_UNSAFE:
            raise RuntimeError(
                "The Intel XPU runtime is unavailable after an earlier synchronization failure. "
                "Restart Maestro before starting another generation."
            )

        outcome = []

        def synchronize_current_stream() -> None:
            try:
                backend.set_device(selected.index or 0)
                backend.current_stream(selected).synchronize()
            except BaseException as error:
                outcome.append(error)

        worker = threading.Thread(
            target=synchronize_current_stream,
            name="maestro-xpu-sync",
            daemon=True,
        )
        worker.start()
        worker.join(_XPU_SYNC_TIMEOUT_SECONDS)
        if worker.is_alive():
            mark_xpu_runtime_unsafe()
            raise RuntimeError(
                "Intel XPU stream synchronization did not finish within "
                f"{_XPU_SYNC_TIMEOUT_SECONDS} seconds. The GPU process was left running; "
                "restart Maestro before starting another generation."
            )
        if outcome:
            mark_xpu_runtime_unsafe()
            raise RuntimeError(
                f"Intel XPU stream synchronization failed: {type(outcome[0]).__name__}: {outcome[0]}. "
                "Restart Maestro before starting another generation."
            ) from outcome[0]


def get_device_properties(device: torch.device | str | int | None = None) -> Any:
    if device is None:
        selected = resolve_device()
    elif isinstance(device, int):
        active = resolve_device()
        selected = torch.device(active.type, device)
    else:
        selected = torch.device(device)
    backend = device_backend(selected)
    if backend is None:
        raise RuntimeError("Device properties are unavailable for the CPU backend.")
    index = selected.index if selected.index is not None else 0
    return backend.get_device_properties(index)
