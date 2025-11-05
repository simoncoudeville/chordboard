import { createApp } from "vue";
import { registerSW } from "virtual:pwa-register";
import App from "./App.vue";
import "@ibm/plex-mono/css/ibm-plex-mono-all.min.css";
import "./style.css";

createApp(App).mount("#app");

// Register the service worker for PWA install/offline support.
registerSW({ immediate: true });
