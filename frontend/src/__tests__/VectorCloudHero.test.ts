import { describe, it, expect, vi, beforeAll } from 'vitest'
import { mount } from '@vue/test-utils'

// Mock theme manager path to avoid executing heavy 3D theme logic in unit tests
vi.mock('../components/art/vectorCloud/themes', () => ({
  ThemeManager: class {
    constructor(_canvas: HTMLCanvasElement) {}
    loadTheme(_themeName: string) {
      return {
        scene: {},
        camera: {},
        renderer: {},
        composer: {},
        dispose: () => {},
      }
    }
    getCurrentTheme() {
      return null
    }
    dispose() {}
    getAvailableThemes() {
      return ['magnetosphere'] as any
    }
    getCurrentThemeName() {
      return 'magnetosphere' as any
    }
  },
  getThemeFromURL: () => null,
}))

beforeAll(() => {
  // jsdom does not support CanvasRenderingContext2D fully, so provide a lightweight stub
  ;(HTMLCanvasElement.prototype as any).getContext = function (type: string) {
    if (type !== '2d') return null
    return {
      createRadialGradient: () => ({ addColorStop: vi.fn() }),
      fillStyle: '',
      fillRect: vi.fn(),
      createImageData: vi.fn(),
      getImageData: vi.fn(),
      putImageData: vi.fn(),
      beginPath: vi.fn(),
      arc: vi.fn(),
      fill: vi.fn(),
      stroke: vi.fn(),
      measureText: () => ({ width: 0 })
    }
  }
})

// Mock Three.js to avoid actual rendering
vi.mock('three', () => ({
  Scene: vi.fn(() => ({ add: vi.fn(), remove: vi.fn() })),
  PerspectiveCamera: vi.fn(() => ({
    aspect: 1,
    updateProjectionMatrix: vi.fn(),
    position: { set: vi.fn() },
    lookAt: vi.fn()
  })),
  CanvasTexture: vi.fn(() => ({
    needsUpdate: false,
    dispose: vi.fn(),
  })),

  WebGLRenderer: vi.fn(() => ({
    setSize: vi.fn(),
    setPixelRatio: vi.fn(),
    getPixelRatio: vi.fn(() => 1),
    getSize: vi.fn(() => ({ width: 800, height: 600 })),
    setClearColor: vi.fn(),
    setAnimationLoop: vi.fn(),
    render: vi.fn(),
    dispose: vi.fn(),
    domElement: document.createElement('canvas'),
    getContext: () => ({})
  })),


  Color: vi.fn(() => ({
    r: 0,
    g: 0,
    b: 0,
    setHex: vi.fn(function (hex: number | string) {
      const value = typeof hex === 'number' ? hex : parseInt(hex.toString().replace('#', ''), 16)
      this.r = ((value >> 16) & 255) / 255
      this.g = ((value >> 8) & 255) / 255
      this.b = (value & 255) / 255
      return this
    }),
    setHSL: vi.fn(function (h: number, s: number, l: number) {
      // approximate conversion for tests
      this.r = h
      this.g = s
      this.b = l
      return this
    }),
    clone: vi.fn(function () {
      const c: any = { ...this }
      c.clone = this.clone
      c.lerp = this.lerp
      return c
    }),
    lerp: vi.fn(function (target: any, alpha: number) {
      this.r = this.r + (target.r - this.r) * alpha
      this.g = this.g + (target.g - this.g) * alpha
      this.b = this.b + (target.b - this.b) * alpha
      return this
    })
  })),
  FogExp2: vi.fn(() => ({})),
  Vector2: vi.fn(function (x = 0, y = 0) { this.x = x; this.y = y }),
  Vector3: vi.fn(function (this: any, x = 0, y = 0, z = 0) {
    this.x = x
    this.y = y
    this.z = z
    this.multiplyScalar = function (scalar: number) {
      this.x *= scalar
      this.y *= scalar
      this.z *= scalar
      return this
    }
    this.addScaledVector = function (vector: any, scalar: number) {
      this.x += vector.x * scalar
      this.y += vector.y * scalar
      this.z += vector.z * scalar
      return this
    }
    this.add = function (vector: any) {
      this.x += vector.x
      this.y += vector.y
      this.z += vector.z
      return this
    }
    return this
  }),

  BufferGeometry: vi.fn(() => {
    const geometry: any = { attributes: {} }
    geometry.setAttribute = (name: string, attribute: any) => {
      geometry.attributes[name] = attribute
    }
    return geometry
  }),
  Points: vi.fn(() => ({})),
  PointsMaterial: vi.fn(() => ({})),
  ShaderMaterial: vi.fn(() => ({})),
  UniformsLib: {},
  BufferAttribute: vi.fn((array, itemSize) => ({ array, itemSize, count: array.length / itemSize, setUsage: vi.fn() })),
  EffectComposer: vi.fn(() => ({ render: vi.fn(), dispose: vi.fn(), addPass: vi.fn() })),

  RenderPass: vi.fn(() => ({})),
  UnrealBloomPass: vi.fn(() => ({})),
  Raycaster: vi.fn(() => ({ setFromCamera: vi.fn(), intersectObjects: () => [] })),
  AmbientLight: vi.fn(() => ({ intensity: 0, color: { r: 0, g: 0, b: 0 } })),
  Clock: vi.fn(() => ({ getDelta: () => 0.016, getElapsedTime: () => 1 })),
  SRGBColorSpace: {},
  ACESFilmicToneMapping: {},
  AdditiveBlending: 1,
}))

import VectorCloudHero from '../components/art/VectorCloudHero.vue'

const heroPalette = {
  name: 'Test Palette',
  primary: '#0ff',
  secondary: '#f0f',
  accent: '#fff',
  background: '#000',
  primaryHSL: '0 0% 0%',
  secondaryHSL: '0 0% 0%',
  accentHSL: '0 0% 0%',
  orb1: '#0ff',
  orb2: '#f0f',
  orb3: '#fff',
}

describe('VectorCloudHero.vue', () => {
  it('should render the hero component', () => {
    const wrapper = mount(VectorCloudHero, { props: { palette: heroPalette }, attachTo: document.body })
    expect(wrapper.exists()).toBe(true)
  })

  it('should have a canvas container', () => {
    const wrapper = mount(VectorCloudHero, { props: { palette: heroPalette }, attachTo: document.body })
    const canvas = wrapper.find('canvas')
    expect(canvas.exists()).toBe(true)
  })

  it('should have navigation buttons', () => {
    const wrapper = mount(VectorCloudHero, { props: { palette: heroPalette }, attachTo: document.body })
    expect(wrapper.findAll('button').length).toBeGreaterThan(0)
  })

  it('should display hero text', () => {
    const wrapper = mount(VectorCloudHero, { props: { palette: heroPalette }, attachTo: document.body })
    expect(wrapper.text().length).toBeGreaterThan(0)
  })

  it('should cleanup on unmount', () => {
    const wrapper = mount(VectorCloudHero, { props: { palette: heroPalette }, attachTo: document.body })
    wrapper.unmount()
    expect(wrapper.vm).toBeDefined()
  })
})
