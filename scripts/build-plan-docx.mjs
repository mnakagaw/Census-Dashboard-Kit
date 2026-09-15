import path from 'node:path';
import {readFile,writeFile} from 'node:fs/promises';
import {parseArgs,reportError,isMain} from '../lib/cli.mjs';
import {validateDataset} from '../lib/validate.mjs';
import {planDocxBytes} from '../scaffold/site/docx.mjs';

export async function buildPlanDocx({project,territory,period,out}) {
  const projectDir=path.resolve(project),data=JSON.parse(await readFile(path.join(projectDir,'data','dashboard.json'),'utf8'));
  const validation=validateDataset(data);if(validation.errors.length)throw new Error(`Country dataset is invalid:\n${validation.errors.join('\n')}`);
  const territoryId=territory||data.country.national_territory_id;
  const selectedPeriod=period==null?null:String(period);
  const filename=path.resolve(out||path.join(projectDir,'evidence',`${data.country.id}-${territoryId}-development-plan.docx`));
  await writeFile(filename,planDocxBytes(data,territoryId,selectedPeriod));
  return {filename,territory_id:territoryId,display_policy:selectedPeriod==null?'latest_per_indicator':'selected_period',period:selectedPeriod};
}

if(isMain(import.meta.url)){
  try{
    const args=parseArgs(process.argv.slice(2),['project','territory','period','out']);
    if(args.help)console.log('node scripts/build-plan-docx.mjs --project <country-project> [--territory <id>] [--out <file.docx>] [--period <value> for legacy/manual use]');
    else{if(!args.project)throw new Error('Provide --project <country-project>');console.log(JSON.stringify(await buildPlanDocx(args),null,2));}
  }catch(error){reportError(error);}
}
