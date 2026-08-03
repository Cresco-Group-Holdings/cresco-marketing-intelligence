type SharpConstructor = typeof import("sharp").default;

let sharpModulePromise: Promise<SharpConstructor> | null = null;

export async function loadSharp(): Promise<SharpConstructor> {
  if (!sharpModulePromise) {
    sharpModulePromise = import("sharp").then((module) => module.default);
  }

  return sharpModulePromise;
}
