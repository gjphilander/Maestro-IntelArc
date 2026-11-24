const { isIntelXpu } = require("./scripts/pinokio/launcher_profile")

module.exports = (kernel) => {
  const useXpu = `${isIntelXpu(kernel)} || (gpu !== 'nvidia' && exists('app/env-xpu/.maestro_xpu_runtime_v1.installed'))`
  return {
    requires: { bundle: "ai" },
    run: [{
      when: "{{exists('app/env-omnivoice/maestro-voices-v1.json')}}",
      method: "fs.rm",
      params: { path: "app/env-omnivoice/maestro-voices-v1.json" },
    }, ...["xpu", "cpu"].map(device => ({
      when: device === "xpu" ? `{{${useXpu}}}` : `{{!(${useXpu})}}`,
      method: "shell.run",
      params: {
        path: "app",
        venv: "env-omnivoice",
        venv_python: "3.12",
        message: [
          `uv pip install torch==2.11.0 torchaudio==2.11.0 --index-url https://download.pytorch.org/whl/${device}`,
          "uv pip install omnivoice==0.2.1 transformers==5.3.0",
          "uv pip check",
          `python -m services.caption_dubbing --check-omnivoice ${device}`,
        ].join(" && "),
      },
    }))],
  }
}
