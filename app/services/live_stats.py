"""Lightweight live system telemetry for the hardware-status indicators.

Returns plain JSON numbers (CPU %, RAM, GPU utilization + VRAM) cheaply
enough to be polled every ~2 seconds by the frontend. This is the JSON
counterpart to the Gradio-era ``shared/utils/stats.py`` (which returns
HTML and blocks 1s on CPU sampling) — kept separate so the polled
endpoint stays dependency-light and non-blocking.

Design notes:
  - CPU uses ``psutil.cpu_percent(interval=None)`` (non-blocking). It
    reports utilization since the *previous* call, so at a ~2s poll
    cadence each reading is a smooth trailing average over that window.
    We prime it once at import so the first real reading is meaningful
    rather than 0.0.
  - NVIDIA GPU telemetry goes through NVML (``pynvml``), which reports
    device-wide utilization and VRAM. XPU: Intel telemetry uses PyTorch's
    device name, capacity, and process memory counters; utilization is
    not exposed by this endpoint for XPU.
  - Every metric is wrapped in try/except so a transient driver hiccup
    degrades one number to 0 instead of failing the whole poll.
"""

import psutil

try:
    import pynvml
    try:
        pynvml.nvmlInit()
        _nvml_ok = True
    except Exception:
        _nvml_ok = False
except Exception:  # pynvml not importable at all
    pynvml = None
    _nvml_ok = False

# Prime the non-blocking CPU sampler so the first poll returns a real
# value instead of 0.0 (psutil keeps per-process state between calls).
try:
    psutil.cpu_percent(interval=None)
except Exception:
    pass


def get_live_stats() -> dict:
    """Return a snapshot of live CPU / RAM / GPU usage as JSON-able numbers."""

    # ---- CPU (non-blocking; since last call) -------------------------
    try:
        cpu_percent = float(psutil.cpu_percent(interval=None))
    except Exception:
        cpu_percent = 0.0

    # ---- RAM ---------------------------------------------------------
    try:
        vm = psutil.virtual_memory()
        ram_percent = float(vm.percent)
        ram_used_gb = vm.used / (1024 ** 3)
        ram_total_gb = vm.total / (1024 ** 3)
        ram_available_gb = vm.available / (1024 ** 3)
    except Exception:
        ram_percent = ram_used_gb = ram_total_gb = 0.0
        ram_available_gb = None

    # ---- GPU (NVIDIA / NVML) -----------------------------------------
    gpu_available = False
    gpu_percent = vram_used_gb = vram_total_gb = vram_percent = 0.0
    gpu_backend = "none"
    gpu_name = ""
    gpu_utilization_available = False
    if _nvml_ok and pynvml is not None:
        try:
            handle = pynvml.nvmlDeviceGetHandleByIndex(0)  # GPU 0
            util = pynvml.nvmlDeviceGetUtilizationRates(handle)
            mem = pynvml.nvmlDeviceGetMemoryInfo(handle)
            name = pynvml.nvmlDeviceGetName(handle)
            if isinstance(name, bytes):
                name = name.decode("utf-8", errors="replace")
            gpu_name = str(name or "")
            gpu_percent = float(util.gpu)
            vram_used_gb = mem.used / (1024 ** 3)
            vram_total_gb = mem.total / (1024 ** 3)
            vram_percent = (mem.used / mem.total) * 100.0 if mem.total else 0.0
            gpu_available = True
            gpu_backend = "cuda"
            gpu_utilization_available = True
        except Exception:
            # GPU asleep / driver transient — report unavailable this tick.
            gpu_available = False

    # XPU: PyTorch reports the selected Intel device and this process's
    # reserved memory. Keep this as a fallback so NVIDIA/NVML behavior is
    # unchanged when an NVIDIA GPU is present.
    if not gpu_available:
        try:
            import torch

            xpu = getattr(torch, "xpu", None)
            if xpu is not None and xpu.is_available():
                props = xpu.get_device_properties(0)
                try:
                    memory_used = max(
                        xpu.memory_reserved(0), xpu.memory_allocated(0)
                    )
                except Exception:
                    memory_used = xpu.memory_allocated(0)
                vram_used_gb = memory_used / (1024 ** 3)
                vram_total_gb = props.total_memory / (1024 ** 3)
                vram_percent = (
                    (memory_used / props.total_memory) * 100.0
                    if props.total_memory else 0.0
                )
                gpu_name = str(xpu.get_device_name(0) or "")
                gpu_available = True
                gpu_backend = "xpu"
        except Exception:
            # Keep the CPU/RAM snapshot usable if XPU telemetry is unavailable.
            pass

    # Report the same device's compute activity and memory usage. Windows'
    # 3D-engine counter includes graphics work across adapters and samples
    # since the previous caller; it is not a reliable CUDA-generation gauge.
    # Keep compute_percent for clients that already consume that field.
    gpu_compute_percent = gpu_percent

    return {
        "cpu": {
            "percent": round(cpu_percent, 1),
        },
        "ram": {
            "percent": round(ram_percent, 1),
            "used_gb": round(ram_used_gb, 2),
            "total_gb": round(ram_total_gb, 2),
            "available_gb": round(ram_available_gb, 2) if ram_available_gb is not None else None,
        },
        "gpu": {
            "available": gpu_available,
            "backend": gpu_backend,
            "name": gpu_name,
            "utilization_available": gpu_utilization_available,
            "percent": round(gpu_percent, 1),
            "compute_percent": round(gpu_compute_percent, 1),
            "vram_used_gb": round(vram_used_gb, 2),
            "vram_total_gb": round(vram_total_gb, 2),
            "vram_percent": round(vram_percent, 1),
        },
    }
