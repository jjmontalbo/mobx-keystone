import { computed, isComputedProp } from "mobx"
import { assert, _ } from "spec.ts"
import {
  decoratedModel,
  ExtendedModel,
  getSnapshot,
  isModelAction,
  model,
  Model,
  modelAction,
  modelIdKey,
  modelTypeKey,
  prop,
  SnapshotInOf,
  SnapshotOutOf,
} from "../../src"
import "../commonSetup"

test("model decorator preserves static properties", () => {
  @model("BarSimple")
  class Bar extends Model({}) {
    static foo = "foo"
  }

  expect(Bar.foo).toBe("foo")
})

test("model decorator preserves static property getters", () => {
  @model("BarWithGetter")
  class Bar extends Model({}) {
    static sideEffectCount = 0
    static get foo() {
      return Bar.sideEffectCount++
    }
  }

  expect(Bar.foo).toBe(0)
  expect(Bar.foo).toBe(1)
})

test("model decorator works with static proxy gymnastics", () => {
  class Bar extends Model({}) {}

  // @ts-ignore
  Bar = new Proxy(Bar, {
    get: (target, key: keyof typeof Bar | "foo") => {
      if (key === "foo") return "oof"
      return target[key]
    },
  })

  // @ts-ignore
  Bar = model("BarWithProxyStuff")(Bar)

  // @ts-ignore
  expect(Bar.foo).toBe("oof")
})

test("model decorator sets model type static prop and toString methods", () => {
  class MyModel extends Model({
    name: prop(() => "hello"),
  }) {
    x: number = 1 // not-stored-properties not rendered
  }

  expect(MyModel[modelTypeKey]).toBeUndefined()

  const type = "com/myModel"
  const MyModel2 = model(type)(MyModel)

  expect(MyModel[modelTypeKey]).toBe(type)
  expect(MyModel2[modelTypeKey]).toBe(type)

  expect(`${MyModel}`).toBe(`class MyModel#${type}`)
  expect(`${MyModel2}`).toBe(`class MyModel#${type}`)

  const inst = new MyModel2({}) as MyModel
  expect(`${inst}`).toBe(`[MyModel#${type} ${JSON.stringify(getSnapshot(inst))}]`)
  expect(`${inst.toString({ withData: false })}`).toBe(`[MyModel#${type}]`)
})

test("decoratedModel", () => {
  let initCalls = 0

  const Point = decoratedModel(
    "decoratedModel/Point",
    class Point<N> extends Model({
      x: prop<number>(5),
      y: prop<number>(),
    }) {
      setX(x: number) {
        this.x = x
      }

      setY = (y: number) => {
        this.y = y
      }

      setXY(x: number, y: number) {
        this.setX(x)
        this.setY(y)
      }

      get length() {
        return this.x + this.y
      }

      volatile = "volatile"
      volatile2!: N

      onInit() {
        initCalls++
      }
    },
    {
      setX: modelAction,
      setY: modelAction,
      setXY: [modelAction],
      length: computed,
    }
  )
  type Point = InstanceType<typeof Point>

  {
    expect(isModelAction(Point.prototype.setX)).toBeTruthy()
    expect(Point.prototype.setY).toBeUndefined()
    expect(isModelAction(Point.prototype.setXY)).toBeTruthy()

    expect(initCalls).toBe(0)
    const p = new Point<number>({ x: 10, y: 20 })
    expect(initCalls).toBe(1)
    expect(isModelAction(p.setX)).toBeTruthy()
    expect(isModelAction(p.setY)).toBeTruthy()
    expect(isModelAction(p.setXY)).toBeTruthy()
    expect(isComputedProp(p, "length"))

    expect(p.x).toBe(10)
    expect(p.y).toBe(20)
    expect(p.length).toBe(30)
    expect(p.volatile).toBe("volatile")
    assert(p.volatile2, _ as number)

    p.setXY(20, 30)
    expect(p.x).toBe(20)
    expect(p.y).toBe(30)
    expect(p.length).toBe(50)

    assert(
      _ as SnapshotInOf<Point>,
      _ as { x?: number | null; y: number } & {
        [modelTypeKey]: string
        [modelIdKey]: string
      }
    )

    assert(
      _ as SnapshotOutOf<Point>,
      _ as { x: number; y: number } & {
        [modelTypeKey]: string
        [modelIdKey]: string
      }
    )
  }

  // extension

  const Point3d = decoratedModel(
    "decoratedModel/Point3d",
    class Point3d extends ExtendedModel(Point, {
      z: prop<number>(),
    }) {
      setZ(z: number) {
        this.z = z
      }

      setXYZ(x: number, y: number, z: number) {
        super.setXY(x, y)
        this.setZ(z)
      }

      get length() {
        return this.x + this.y + this.z
      }
    },
    {
      setZ: modelAction,
      setXYZ: modelAction,
      length: computed,
    }
  )
  type Point3d = InstanceType<typeof Point3d>

  {
    expect(isModelAction(Point3d.prototype.setX)).toBeTruthy()
    expect(Point3d.prototype.setY).toBeUndefined()
    expect(isModelAction(Point3d.prototype.setXY)).toBeTruthy()
    expect(isModelAction(Point3d.prototype.setZ)).toBeTruthy()
    expect(isModelAction(Point3d.prototype.setXYZ)).toBeTruthy()

    const p2 = new Point3d({ x: 10, y: 20, z: 30 })
    expect(isModelAction(p2.setX)).toBeTruthy()
    expect(isModelAction(p2.setY)).toBeTruthy()
    expect(isModelAction(p2.setXY)).toBeTruthy()
    expect(isModelAction(p2.setZ)).toBeTruthy()
    expect(isModelAction(p2.setXYZ)).toBeTruthy()
    expect(isComputedProp(p2, "length"))

    expect(p2.x).toBe(10)
    expect(p2.y).toBe(20)
    expect(p2.z).toBe(30)
    expect(p2.length).toBe(60)
    expect(p2.volatile).toBe("volatile")
    assert(p2.volatile2, _ as unknown) // known issue, no way to specify generic for base class

    p2.setXYZ(20, 30, 40)
    expect(p2.x).toBe(20)
    expect(p2.y).toBe(30)
    expect(p2.z).toBe(40)
    expect(p2.length).toBe(90)

    assert(
      _ as SnapshotInOf<Point3d>,
      _ as { x?: number | null; y: number; z: number } & {
        [modelTypeKey]: string
        [modelIdKey]: string
      }
    )

    assert(
      _ as SnapshotOutOf<Point3d>,
      _ as { x: number; y: number; z: number } & {
        [modelTypeKey]: string
        [modelIdKey]: string
      }
    )
  }
})
