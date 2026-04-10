interface DryrunOptions {
  trainee: string;
  seed?: number;
}

export function dryrunCommand(path: string, opts: DryrunOptions): void {
  console.log(`TODO(phase-1): dry-run ${path} with trainee=${opts.trainee}`);
  process.exit(0);
}
