import vehicle from './data/vehicles/sonata-2016.json';
import engineData from './data/parts/engine-2.4-gdi.json';
import { createStage } from './scene/stage.js';
import { createCar } from './vehicle/car.js';
import { buildProceduralEngine } from './engine/procedural-engine.js';
import { createEngineController } from './engine/engine-controller.js';
import { defaultConfig } from './configurator/state.js';

export async function startApp(el) {
  el.innerHTML = '<div id="viewport" style="position:fixed;inset:0"></div>';
  const stage = createStage(el.querySelector('#viewport'));
  const car = await createCar(vehicle);
  stage.scene.add(car.root);
  const engine = buildProceduralEngine(engineData);
  car.engineMount.add(engine.root);
  const ctl = createEngineController({ root: engine.root, parts: engine.parts, partsData: engineData, montaje: vehicle.motor_montaje, openHood: () => car.setOpen('cofre', true) });
  const cfg = defaultConfig(vehicle);
  car.applyConfig(cfg, { animate: false });
  window.__t = { stage, car, ctl, cfg };
}
