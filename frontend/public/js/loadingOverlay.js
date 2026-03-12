// Global loader utility mounted once per page and shared by all `apiFetch` wrappers.
(function initGlobalAppLoader() {
  let pendingCount = 0;
  let overlay = null;
  let label = null;

  // Injects loader CSS lazily so pages don't need dedicated stylesheet wiring.
  const ensureStyles = () => {
    if (document.getElementById("appLoaderStyles")) return;

    const style = document.createElement("style");
    style.id = "appLoaderStyles";
    style.textContent = `
      .app-loader-overlay {
        position: fixed;
        inset: 0;
        z-index: 12000;
        display: none;
        align-items: center;
        justify-content: center;
        padding: 16px;
        background: rgba(248, 250, 252, 0.82);
        backdrop-filter: blur(2px);
      }
      .app-loader-overlay.open {
        display: flex;
      }
      .app-loader-card {
        min-width: 220px;
        border: 1px solid #e2e8f0;
        border-radius: 14px;
        background: #ffffff;
        box-shadow: 0 16px 40px rgba(15, 23, 42, 0.12);
        padding: 18px 20px;
        display: grid;
        justify-items: center;
        gap: 10px;
      }
      .app-loader-spinner {
        width: 30px;
        height: 30px;
        border: 3px solid #e2e8f0;
        border-top-color: #ffb400;
        border-radius: 999px;
        animation: appLoaderSpin 0.8s linear infinite;
      }
      .app-loader-label {
        margin: 0;
        color: #64748b;
        font-size: 13px;
        font-weight: 600;
      }
      body.app-loader-active {
        overflow: hidden;
      }
      @keyframes appLoaderSpin {
        to {
          transform: rotate(360deg);
        }
      }
    `;
    document.head.appendChild(style);
  };

  // Reuses existing overlay if present, otherwise creates loader DOM once.
  const ensureOverlay = () => {
    if (overlay) return;
    ensureStyles();

    overlay = document.getElementById("appLoadingOverlay");
    if (!overlay) {
      overlay = document.createElement("div");
      overlay.id = "appLoadingOverlay";
      overlay.className = "app-loader-overlay";
      overlay.setAttribute("aria-hidden", "true");
      overlay.setAttribute("role", "status");
      overlay.innerHTML = `
        <div class="app-loader-card">
          <div class="app-loader-spinner" aria-hidden="true"></div>
          <p class="app-loader-label" id="appLoadingLabel">Loading...</p>
        </div>
      `;
      document.body.appendChild(overlay);
    }

    label = overlay.querySelector("#appLoadingLabel");
  };

  // Increments in-flight counter and shows overlay for current async operation.
  const show = (message = "Loading...") => {
    ensureOverlay();
    pendingCount += 1;
    if (label) {
      label.textContent = message;
    }
    overlay.classList.add("open");
    overlay.setAttribute("aria-hidden", "false");
    document.body.classList.add("app-loader-active");
  };

  // Decrements counter and hides overlay only after all tracked operations finish.
  const hide = () => {
    if (pendingCount > 0) {
      pendingCount -= 1;
    }

    if (pendingCount > 0) return;
    pendingCount = 0;

    ensureOverlay();
    overlay.classList.remove("open");
    overlay.setAttribute("aria-hidden", "true");
    document.body.classList.remove("app-loader-active");
  };

  // Hard reset helper for defensive cleanup in exceptional flows.
  const reset = () => {
    pendingCount = 0;
    if (!overlay) return;
    overlay.classList.remove("open");
    overlay.setAttribute("aria-hidden", "true");
    document.body.classList.remove("app-loader-active");
  };

  // Exposes loader API globally for app scripts.
  window.AppLoader = {
    show,
    hide,
    reset,
  };
})();
