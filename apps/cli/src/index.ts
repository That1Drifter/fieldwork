#!/usr/bin/env node
import { Command } from 'commander';
import { validateCommand } from './commands/validate.js';
import { initCommand } from './commands/init.js';
import { dryrunCommand } from './commands/dryrun.js';
import { playCommand } from './commands/play.js';
import { costEstimateCommand } from './commands/cost-estimate.js';

const program = new Command();

program
  .name('fieldwork')
  .description('Fieldwork scenario authoring and dry-run CLI')
  .version('0.0.0');

program
  .command('validate <path>')
  .description('Validate a scenario manifest against the schema')
  .action(validateCommand);

program
  .command('init <name>')
  .description('Scaffold a new scenario manifest')
  .action(initCommand);

program
  .command('dryrun <path>')
  .description('Run a scenario headlessly with a scripted trainee')
  .option('--trainee <kind>', 'trainee profile: perfect | chaotic', 'perfect')
  .option('--seed <n>', 'override the scenario seed', parseInt)
  .action(dryrunCommand);

program
  .command('play <path>')
  .description('Play a scenario interactively in the terminal')
  .action(playCommand);

program
  .command('cost-estimate <path>')
  .description('Estimate the API cost of running this scenario')
  .action(costEstimateCommand);

program.parseAsync(process.argv);
