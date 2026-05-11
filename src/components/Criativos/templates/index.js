import clean from './clean'
import bold from './bold'
import quote from './quote'

export const TEMPLATES = [clean, bold, quote]
export const TEMPLATES_BY_ID = Object.fromEntries(TEMPLATES.map((t) => [t.id, t]))
