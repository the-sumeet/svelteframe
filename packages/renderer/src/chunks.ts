import { spawn } from 'node:child_process';
import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';

/** The playlist ffmpeg's concat demuxer reads: one `file '<path>'` line per chunk. */
export function concatList(files: string[]): string {
	return files.map((file) => `file '${file.replaceAll("'", `'\\''`)}'`).join('\n') + '\n';
}

/**
 * Join chunks that were encoded with identical settings into one file without re-encoding.
 * Each chunk starts on a keyframe, so they can be cut together exactly.
 */
export async function concatChunks(files: string[], output: string, workDir: string): Promise<void> {
	if (files.length === 0) throw new Error('concatChunks needs at least one chunk');

	const list = join(workDir, 'chunks.txt');
	await writeFile(list, concatList(files));

	await new Promise<void>((resolve, reject) => {
		const ffmpeg = spawn(
			'ffmpeg',
			['-hide_banner', '-loglevel', 'error', '-y', '-f', 'concat', '-safe', '0', '-i', list, '-c', 'copy', output],
			{ stdio: ['ignore', 'ignore', 'pipe'] }
		);
		let stderr = '';
		ffmpeg.stderr.on('data', (chunk: Buffer) => (stderr = (stderr + chunk).slice(-16 * 1024)));
		ffmpeg.once('error', reject);
		ffmpeg.once('close', (code) =>
			code === 0 ? resolve() : reject(new Error(`ffmpeg could not join the chunks (code ${code})\n${stderr}`))
		);
	});
}
