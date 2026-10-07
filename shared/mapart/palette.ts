/** 平坦地毯在地图上的颜色：基色 × 220/255（北侧同高的那一档）。 */

export interface Carpet {
  id: number
  block: string
  name: string
  base: [number, number, number]
  rgb: [number, number, number]
}

function shade(channel: number): number {
  return Math.floor((channel * 220) / 255)
}

function carpet(
  id: number,
  block: string,
  name: string,
  base: [number, number, number],
): Carpet {
  return {
    id,
    block: `minecraft:${block}`,
    name,
    base,
    rgb: [shade(base[0]), shade(base[1]), shade(base[2])],
  }
}

export const CARPETS: Carpet[] = [
  carpet(0, 'white_carpet', '白色地毯', [255, 255, 255]),
  carpet(1, 'orange_carpet', '橙色地毯', [216, 127, 51]),
  carpet(2, 'magenta_carpet', '品红色地毯', [178, 76, 216]),
  carpet(3, 'light_blue_carpet', '浅蓝色地毯', [102, 153, 216]),
  carpet(4, 'yellow_carpet', '黄色地毯', [229, 229, 51]),
  carpet(5, 'lime_carpet', '黄绿色地毯', [127, 204, 25]),
  carpet(6, 'pink_carpet', '粉红色地毯', [242, 127, 165]),
  carpet(7, 'gray_carpet', '灰色地毯', [76, 76, 76]),
  carpet(8, 'light_gray_carpet', '浅灰色地毯', [153, 153, 153]),
  carpet(9, 'cyan_carpet', '青色地毯', [76, 127, 153]),
  carpet(10, 'purple_carpet', '紫色地毯', [127, 63, 178]),
  carpet(11, 'blue_carpet', '蓝色地毯', [51, 76, 178]),
  carpet(12, 'brown_carpet', '棕色地毯', [102, 76, 51]),
  carpet(13, 'green_carpet', '绿色地毯', [102, 127, 51]),
  carpet(14, 'red_carpet', '红色地毯', [153, 51, 51]),
  carpet(15, 'black_carpet', '黑色地毯', [25, 25, 25]),
]

export const AIR_BLOCK = 'minecraft:air'

export const ALLOWED_BLOCKS = new Set<string>([AIR_BLOCK, ...CARPETS.map((c) => c.block)])

export const MINECRAFT_DATA_VERSION = 4786
export const LITEMATIC_VERSION = 6
export const MAP_SIZE = 128
export const MAX_MAPS = 8

export function woolCount(carpetCount: number): number {
  return Math.ceil((carpetCount * 2) / 3)
}
