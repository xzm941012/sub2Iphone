export function resolveAppearance(preference:string,systemDark:boolean){return preference==='dark'||preference==='system'&&systemDark?'dark':'light';}
