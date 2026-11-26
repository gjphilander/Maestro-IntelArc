export const venuePresets = [
  ['Living room', 'A lived-in living room with clear paths between the seating area and doorway.'],
  ['Kitchen', 'A residential kitchen with counters, storage, and clear space for food preparation.'],
  ['Café', 'A neighbourhood café with a service counter, seating, and a street-facing window.'],
  ['Office', 'A contemporary office with work surfaces, circulation space, and practical lighting.'],
  ['Bedroom', 'A private bedroom with space to move around the bed and toward the door.'],
  ['City street', 'An urban street with a pavement, building fronts, and a clear line of sight down the block.'],
  ['Garden', 'A garden with planted borders, an open patch, and a path between them.'],
  ['Beach', 'An open shoreline with sand in the foreground and a clear horizon beyond the water.'],
  ['Studio', 'An uncluttered production studio with a seamless backdrop and open floor space.'],
  ['Warehouse', 'A spacious industrial warehouse with tall ceilings and a clear central aisle.'],
] as const

export const objectPresets = [
  ['Sofa', 'Furniture', 'Floor', 'Large', 'Fabric'],
  ['Armchair', 'Furniture', 'Floor', 'Medium', 'Fabric'],
  ['Dining table', 'Furniture', 'Floor', 'Large', 'Wood'],
  ['Stool', 'Furniture', 'Floor', 'Medium', 'Wood'],
  ['Bookcase', 'Furniture', 'Floor', 'Large', 'Wood'],
  ['Bed', 'Furniture', 'Floor', 'Large', 'Fabric'],
  ['Framed photograph', 'Decor', 'Wall', 'Small', 'Wood'],
  ['Vase', 'Decor', 'Table', 'Small', 'Ceramic'],
  ['Mirror', 'Decor', 'Wall', 'Medium', 'Glass'],
  ['Rug', 'Textiles', 'Floor', 'Large', 'Fabric'],
  ['Curtains', 'Textiles', 'Wall', 'Large', 'Fabric'],
  ['Potted plant', 'Plants', 'Floor', 'Medium', 'Ceramic pot'],
  ['Desk lamp', 'Lighting', 'Table', 'Small', 'Metal'],
  ['Pendant light', 'Lighting', 'Ceiling', 'Medium', 'Glass'],
  ['Laptop', 'Technology', 'Table', 'Small', 'Metal'],
  ['Phone', 'Technology', 'Hand', 'Small', 'Glass and metal'],
  ['Television', 'Technology', 'Wall', 'Medium', 'Glass'],
  ['Mug', 'Kitchenware', 'Table', 'Small', 'Ceramic'],
  ['Plate', 'Kitchenware', 'Table', 'Small', 'Ceramic'],
  ['Kettle', 'Kitchenware', 'Counter', 'Small', 'Metal'],
  ['Folded letter', 'Personal props', 'Table', 'Small', 'Paper'],
  ['Key', 'Personal props', 'Table', 'Small', 'Metal'],
  ['Suitcase', 'Personal props', 'Floor', 'Medium', 'Fabric'],
  ['Bench', 'Outdoor', 'Ground', 'Large', 'Wood'],
  ['Street sign', 'Outdoor', 'Ground', 'Medium', 'Metal'],
] as const

export const horizontalPositions = ['Left', 'Centre', 'Right'] as const
export const depthPositions = ['Foreground', 'Midground', 'Background'] as const
export const objectScales = ['Small', 'Medium', 'Large', 'Custom'] as const
export const placementSurfaces = ['Floor', 'Ground', 'Wall', 'Ceiling', 'Table', 'Counter', 'Hand'] as const
export const objectVisibility = ['Visible', 'Hidden', 'Partially obscured'] as const
export const objectLighting = ['Reflective', 'Emissive', 'Shadow casting'] as const
export const castTypes = ['Person', 'Actor', 'Animal', 'Extra'] as const

function sceneItemId() {
  return crypto.randomUUID?.() ?? crypto.getRandomValues(new Uint32Array(4)).join('-')
}

export function newSceneObject(
  [name, category, placement, scale, material]: readonly [string, string, string, string, string],
) {
  return {
    id: sceneItemId(),
    name, category, placement, scale, material,
    horizontal: 'Centre',
    depth: 'Midground',
    customScale: '',
    rotation: '',
    colour: '',
    state: '',
    animation: 'Static',
    interaction: '',
    visibility: 'Visible',
    lighting: '',
    anchor: '',
    persistent: true,
  }
}

export function newSceneCharacter(name: string, type: string) {
  return {
    id: sceneItemId(),
    name, type,
    horizontal: 'Centre',
    depth: 'Midground',
    appearance: '',
    action: '',
  }
}

export type SceneObject = ReturnType<typeof newSceneObject>
export type SceneCharacter = ReturnType<typeof newSceneCharacter>

export const emptyVenueScene = {
  venue: '',
  customVenue: '',
  venueDetails: '',
  objects: [] as SceneObject[],
  characters: [] as SceneCharacter[],
  lighting: '',
  weather: '',
  time: '',
  atmosphere: '',
  camera: '',
  soundscape: '',
}

export type VenueScene = typeof emptyVenueScene

const storageKey = 'maestro.venueScene.v1'

export function loadVenueScene(): VenueScene {
  try {
    const value = localStorage.getItem(storageKey)
    return value ? { ...emptyVenueScene, ...JSON.parse(value) } as VenueScene : emptyVenueScene
  } catch {
    return emptyVenueScene
  }
}

export function saveVenueScene(scene: VenueScene) {
  try {
    localStorage.setItem(storageKey, JSON.stringify(scene))
  } catch {
    // The current draft is still available when browser storage is restricted.
  }
}

const compact = (value: string) => value.trim().replace(/\s+/g, ' ')

function sentence(value: string) {
  const text = compact(value)
  return /[.!?]$/.test(text) ? text : `${text}.`
}

export function venueName(scene: VenueScene) {
  return compact(scene.venue === 'custom' ? scene.customVenue : scene.venue)
}

export function buildVenuePrompt(scene: VenueScene) {
  const venue = venueName(scene)
  if (!venue) return ''
  const preset = venuePresets.find(([name]) => name === scene.venue)
  const characters = scene.characters.filter(character => compact(character.name))
  const objects = scene.objects.filter(object => compact(object.name))
  const subjectDefinitions = characters.map(character => sentence(
    `${compact(character.name)} is a scene ${character.type.toLowerCase()}${character.appearance.trim() ? ` with this appearance: ${compact(character.appearance)}` : ''}`,
  ))
  const blocking = characters.map(character => sentence(
    `${compact(character.name)} is positioned at ${character.horizontal.toLowerCase()} in the ${character.depth.toLowerCase()}${character.action.trim() ? ` and performs this action: ${compact(character.action)}` : ''}`,
  ))
  const props = objects.map(object => {
    const properties = [
      ['category', object.category],
      ['position', `${object.horizontal.toLowerCase()}, ${object.depth.toLowerCase()}`],
      ['placement', object.placement.toLowerCase()],
      ['placement detail', object.anchor],
      ['scale', object.scale === 'Custom' ? object.customScale : object.scale.toLowerCase()],
      ['rotation', object.rotation.trim() ? `${object.rotation.trim()}°` : ''],
      ['material', object.material],
      ['colour', object.colour],
      ['state', object.state],
      ['animation', object.animation],
      ['interaction', object.interaction],
      ['visibility', object.visibility],
      ['lighting behaviour', object.lighting],
    ].flatMap(([key, value]) => compact(value) ? [`${key}: ${compact(value)}`] : [])
    return sentence(`Object: ${compact(object.name)} (${properties.join(', ')})`)
  })
  const persistent = objects.filter(object => object.persistent).map(object => compact(object.name))
  const conditions = [
    ['Time of day', scene.time], ['Weather', scene.weather], ['Lighting', scene.lighting],
    ['Atmosphere', scene.atmosphere], ['Camera', scene.camera],
  ].flatMap(([label, value]) => compact(value) ? [sentence(`${label}: ${value}`)] : [])
  const description = [
    sentence(`Venue: ${venue}`), preset?.[1], scene.venueDetails.trim() && sentence(scene.venueDetails),
    ...conditions, ...blocking, ...props,
  ].filter(Boolean).join(' ')
  return [
    `subject_definitions: ${subjectDefinitions.join(' ') || 'N/A'}`,
    `summary: ${sentence(`A scene set in ${venue}`)}`,
    `retention_analysis: ${persistent.length ? sentence(`Keep these objects consistent between shots in appearance, scale, state, and placement unless the action changes them: ${persistent.join(', ')}`) : 'N/A'}`,
    `detailed_description: ${description}`,
    `overall_soundscape: ${compact(scene.soundscape) ? sentence(scene.soundscape) : 'N/A'}`,
    'non_diegetic_music: N/A',
  ].join(' ')
}
