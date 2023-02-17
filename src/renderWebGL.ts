import {createBuffer, createProgram, createShader, createVAO} from './gl';
import {Params} from './params';
import {GPUState} from './state';
import {memoize} from './util';
import drawParticlesVert from './drawParticles.vert.glsl';
import drawParticlesFrag from './drawParticles.frag.glsl';

const getCircleVertexBuffer = memoize(
  (gl: WebGL2RenderingContext, vertexCount: number) =>
    createBuffer(gl, {
      data: new Float32Array(
        Array.from({length: vertexCount}).flatMap((_, i) => [
          Math.cos((i / vertexCount) * 2 * Math.PI),
          Math.sin((i / vertexCount) * 2 * Math.PI),
        ])
      ),
      usage: gl.STATIC_DRAW,
    })
);

const getCircleVAO = memoize(
  (gl: WebGL2RenderingContext, vertexCount: number) =>
    createVAO(gl, {
      attribs: [{buffer: getCircleVertexBuffer(gl, vertexCount), size: 2}],
    })
);

const getDrawParticlesVert = memoize((gl: WebGL2RenderingContext) =>
  createShader(gl, {source: drawParticlesVert, type: gl.VERTEX_SHADER})
);

const getDrawParticlesFrag = memoize((gl: WebGL2RenderingContext) =>
  createShader(gl, {source: drawParticlesFrag, type: gl.FRAGMENT_SHADER})
);

const getDrawParticlesProgram = memoize((gl: WebGL2RenderingContext) =>
  createProgram(gl, {
    shaders: [getDrawParticlesVert(gl), getDrawParticlesFrag(gl)],
  })
);

export const renderWebGL = (
  gl: WebGL2RenderingContext,
  gpuState: GPUState,
  params: Params
) => {
  const circleVertices = 10;
  const program = getDrawParticlesProgram(gl);
  const circleVAO = getCircleVAO(gl, circleVertices);

  gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);
  gl.clearColor(1, 1, 1, 1);
  gl.clear(gl.COLOR_BUFFER_BIT);

  gl.useProgram(program);
  gl.bindVertexArray(circleVAO);

  gl.activeTexture(gl.TEXTURE0);
  gl.bindTexture(gl.TEXTURE_2D, gpuState.position.read.texture);
  gl.uniform1i(gl.getUniformLocation(program, 'positionSampler'), 0);

  gl.uniform2i(gl.getUniformLocation(program, 'resolution'), gpuState.n, 1);
  gl.uniform1f(
    gl.getUniformLocation(program, 'particleRadius'),
    params.particleRadius
  );

  gl.drawArraysInstanced(gl.TRIANGLE_FAN, 0, circleVertices, gpuState.n);

  gl.bindVertexArray(null);
  gl.useProgram(null);
};
