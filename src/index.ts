import './reset.css';
import './index.css';
import {makeDamBreak} from './scene';
import {State, allocateState, GPUState, allocateGPUState} from './state';
import {Params, makeDefaultParams} from './params';
import {updateSimulation} from './simulation';
import {initPointer, updatePointer} from './pointer';
import {createUi} from './tweaks';
import {profileWrapper, enableFloatTexture} from './gl/gl';
import {testSort} from './sortGPU';
import {copyStateToGPU} from './copyState';
import {updateSimulationGPU} from './simulationGPU';
import {renderCanvas2D} from './renderCanvas2D';
import {renderWebGL} from './renderWebGL';
import {UniformContext} from './gl/UniformContext';
import {resetUniforms} from './shader/uniforms';
import {
  allocateDisplayTextures,
  DisplayTextures,
  resizeDisplayTextures,
} from './displayTextures';

type RunnerState = {
  running: boolean;
  step: boolean;
  tLast: number;
};

const resize = (
  canvas: HTMLCanvasElement,
  gl: WebGL2RenderingContext | null,
  displayTextures: DisplayTextures | null
) => {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
  if (gl) {
    resizeDisplayTextures(gl, displayTextures, {
      width: canvas.width,
      height: canvas.height,
    });
  }
};

const reset = (
  canvas: HTMLCanvasElement,
  state: State,
  gpuState: GPUState | null,
  params: Params
) => {
  makeDamBreak(state, params);
  if (gpuState) {
    const gl = profileWrapper(canvas.getContext('webgl2'));
    copyStateToGPU(gl, state, gpuState, params);
  }
};

const initKeybinds = (
  canvas: HTMLCanvasElement,
  runnerState: RunnerState,
  state: State,
  gpuState: GPUState | null,
  params: Params
) => {
  addEventListener(
    'keydown',
    (event) => {
      if (event.code == 'Space') {
        runnerState.running = !runnerState.running;
      }
      if (event.code == 'KeyR') {
        reset(canvas, state, gpuState, params);
      }
      if (event.code == 'KeyS') {
        runnerState.step = true;
      }
    },
    false
  );
};

const frame = (
  canvas: HTMLCanvasElement,
  runnerState: RunnerState,
  state: State,
  gpuState: GPUState,
  params: Params,
  displayTextures: DisplayTextures
) => {
  const dt = 10 ** params.logTimestep / params.substeps;
  const realDt = (Date.now() - runnerState.tLast) / 1000;
  runnerState.tLast = Date.now();

  updatePointer(realDt);

  const uniforms = new UniformContext();
  if (params.mode === 'webgl') {
    const gl = profileWrapper(canvas.getContext('webgl2'));
    resetUniforms(uniforms, gl, displayTextures, gpuState, params, dt);
  }

  if (runnerState.running || runnerState.step) {
    if (params.mode === 'cpu') {
      updateSimulation(state, params, dt);
    } else {
      const gl = profileWrapper(canvas.getContext('webgl2'));
      updateSimulationGPU(gl, gpuState, params, dt, uniforms);
    }
    runnerState.step = false;
  }

  if (params.mode === 'cpu') {
    const ctx = canvas.getContext('2d');
    renderCanvas2D(ctx, state, params);
  } else {
    const gl = profileWrapper(canvas.getContext('webgl2'));
    renderWebGL(gl, displayTextures, gpuState, uniforms, params);
  }
};

const init = () => {
  const params: Params = makeDefaultParams();
  const canvas = document.createElement('canvas');

  let gl: WebGL2RenderingContext | null = null;
  if (params.mode === 'webgl') {
    gl = canvas.getContext('webgl2');
    if (!gl) {
      throw new Error('Failed to get WebGL2 context');
    }
    if (!enableFloatTexture(gl)) {
      throw new Error('Device does not support rendering to float texture');
    }
    // testSort(gl);
  }

  const runnerState: RunnerState = {
    running: true,
    step: false,
    tLast: Date.now(),
  };

  const state: State = allocateState(params);
  const gpuState: GPUState | null = gl ? allocateGPUState({gl, params}) : null;
  const displayTextures: DisplayTextures = allocateDisplayTextures();

  document.getElementById('container')!.appendChild(canvas);
  addEventListener('resize', () => resize(canvas, gl, displayTextures), false);

  resize(canvas, gl, displayTextures);
  reset(canvas, state, gpuState, params);
  initPointer();
  initKeybinds(canvas, runnerState, state, gpuState, params);
  createUi(params);

  const runFrame = () => {
    frame(canvas, runnerState, state, gpuState, params, displayTextures);
    requestAnimationFrame(runFrame);
  };
  requestAnimationFrame(runFrame);
};

init();
