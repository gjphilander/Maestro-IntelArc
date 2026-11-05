#!/usr/bin/env python3
# XPU: Check Intel XPU visibility and run small matmul and SDPA checks.
from __future__ import annotations

import os
import sys
import traceback


if os.environ.get("MAESTRO_DEVICE", "").strip().lower() == "xpu":
    # XPU: match the Level Zero defaults used by the actual app process.
    if os.environ.get("MAESTRO_XPU_IMMEDIATE_COMMANDLISTS", "").strip().lower() in (
        "1", "true", "yes", "on"
    ):
        os.environ.setdefault("SYCL_PI_LEVEL_ZERO_USE_IMMEDIATE_COMMANDLISTS", "1")
    if os.name == "nt":
        os.environ.setdefault("NEO_LOCAL_MEMORY_ALLOCATION_MODE", "1")
    if os.environ.get("MAESTRO_XPU_DEBUG_SYNC") == "1":
        os.environ["SYCL_LAUNCH_BLOCKING"] = "1"


def main() -> int:
    try:
        import torch

        print(f"torch={torch.__version__}")
        print(
            "level_zero_immediate_commandlists="
            f"{os.environ.get('SYCL_PI_LEVEL_ZERO_USE_IMMEDIATE_COMMANDLISTS', 'unset')}"
        )
        print(
            "level_zero_overcommit_mode="
            f"{os.environ.get('NEO_LOCAL_MEMORY_ALLOCATION_MODE', 'default')}"
        )
        print(f"torch.xpu.is_available()={torch.xpu.is_available()}")
        if not torch.xpu.is_available():
            raise RuntimeError(
                "Intel XPU is unavailable. Install the current Intel Arc driver/runtime, "
                "then verify the XPU PyTorch wheel and ONEAPI_DEVICE_SELECTOR."
            )

        device = torch.device("xpu:0")
        properties = torch.xpu.get_device_properties(device)
        name = torch.xpu.get_device_name(device)
        memory = getattr(properties, "total_memory", None)
        print(f"device={name}")
        if memory is not None:
            print(f"vram_gib={memory / 1024**3:.2f}")

        dtype = torch.float32
        left_cpu = torch.randn((64, 64), dtype=dtype)
        right_cpu = torch.randn((64, 64), dtype=dtype)
        left = left_cpu.to(device)
        right = right_cpu.to(device)
        product = left @ right
        torch.xpu.synchronize(device)
        if not torch.allclose(product.cpu(), left_cpu @ right_cpu, rtol=1e-3, atol=1e-3):
            raise RuntimeError("XPU matmul differed from the CPU reference.")

        query_cpu = torch.randn((1, 2, 16, 32), dtype=dtype)
        key_cpu = torch.randn_like(query_cpu)
        value_cpu = torch.randn_like(query_cpu)
        query = query_cpu.to(device)
        key = key_cpu.to(device)
        value = value_cpu.to(device)
        attention = torch.nn.functional.scaled_dot_product_attention(query, key, value)
        attention_cpu = torch.nn.functional.scaled_dot_product_attention(query_cpu, key_cpu, value_cpu)
        torch.xpu.synchronize(device)
        if not torch.allclose(attention.cpu(), attention_cpu, rtol=1e-3, atol=1e-3):
            raise RuntimeError("XPU scaled-dot-product attention differed from the CPU reference.")

        print("matmul=PASS")
        print("sdpa=PASS")
        print("XPU preflight PASS")
        return 0
    except Exception as error:
        print(f"XPU preflight FAIL: {type(error).__name__}: {error}", file=sys.stderr)
        if os.environ.get("MAESTRO_XPU_PREFLIGHT_TRACE") == "1":
            traceback.print_exc()
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
