import './ui/styles.css';
import { startApp } from './app.js';

startApp(document.getElementById('app')).catch((err) => {
  console.error(err);
  document.getElementById('app').innerHTML = `<p style="padding:24px">No se pudo iniciar MiNave: ${err.message}</p>`;
});
