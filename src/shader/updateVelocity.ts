import {compile, glsl} from '../gl/glslpp';
import {foreachNeighbor} from './foreachNeighbor';
import {
  collisionDistance,
  dt,
  eta,
  fPressureSampler,
  massSampler,
  particleRestitution,
  positionSampler,
  velocityGuessSampler,
  velocitySampler,
  wallRestitution,
} from './uniforms';

export const updateVelocityFs = compile(glsl`
out vec4 outVelocity;

void main() {
  ivec2 texCoord = ivec2(gl_FragCoord.xy);
  vec2 velocityGuess = texelFetch(${velocityGuessSampler}, texCoord, 0).rg;
  vec2 ownPos = texelFetch(${positionSampler}, texCoord, 0).rg;
  float ownMass = texelFetch(${massSampler}, texCoord, 0).r;
  vec2 fPressure = texelFetch(${fPressureSampler}, texCoord, 0).rg;

  vec2 velocity = velocityGuess + (${dt} / ownMass) * fPressure;

  // kinematic particle-particle collisions
  float collidedMass = 0.;
  vec2 dvCollsion = vec2(0.);
  ${foreachNeighbor}(neighborTexCoord, {
    float neighborMass = texelFetch(${massSampler}, neighborTexCoord, 0).x;
    vec2 neighborPos = texelFetch(${positionSampler}, neighborTexCoord, 0).xy;
    vec2 neighborVelGuess = texelFetch(${velocityGuessSampler}, neighborTexCoord, 0).xy;
    vec2 dx = ownPos - neighborPos;
    vec2 dv = velocityGuess - neighborVelGuess;
    float d = length(dx) + ${eta};
    float dotDxDv = dot(dx, dv);
    if (d < ${collisionDistance} && dotDxDv < 0.) {
      collidedMass += neighborMass;
      dvCollsion += neighborMass * (1. + ${particleRestitution}) * (dotDxDv / d) * (dx / d);
    }
  })

  float collisionTerm = 1. / (ownMass + collidedMass);
  velocity -= collisionTerm * dvCollsion;

  // kinematic particle-wall collisions
  if (velocity.x < 0. && ownPos.x < 0.) {
    velocity.x *= -${wallRestitution};
  }
  if (velocity.x > 0. && ownPos.x > 1.) {
    velocity.x *= -${wallRestitution};
  }
  if (velocity.y < 0. && ownPos.y < 0.) {
    velocity.y *= -${wallRestitution};
  }
  if (velocity.y > 0. && ownPos.y > 1.) {
    velocity.y *= -${wallRestitution};
  }

  outVelocity = vec4(velocity, 0.0, 0.0);
}
`);
