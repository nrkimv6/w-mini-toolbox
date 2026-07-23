/**
 * Unit Tests for toolSummary — 도구별 요약 추출 계약 검증
 */
import { describe, it, expect } from 'vitest';
import { summarizeToolInput } from './toolSummary.js';

describe('summarizeToolInput', () => {
	it('Bash: description이 있으면 description을 우선 사용한다', () => {
		const result = summarizeToolInput('Bash', {
			description: '패키지 설치',
			command: 'npm install'
		});
		expect(result).toBe('패키지 설치');
	});

	it('Bash: description이 없으면 command를 사용한다', () => {
		const result = summarizeToolInput('Bash', { command: 'npm run build' });
		expect(result).toBe('npm run build');
	});

	it('Read/Write/Edit: file_path의 basename만 추출한다 (posix)', () => {
		expect(summarizeToolInput('Read', { file_path: '/home/user/project/foo.ts' })).toBe(
			'foo.ts'
		);
		expect(summarizeToolInput('Write', { file_path: '/a/b/bar.md' })).toBe('bar.md');
		expect(summarizeToolInput('Edit', { file_path: '/a/b/baz.svelte' })).toBe('baz.svelte');
	});

	it('Read: file_path의 basename만 추출한다 (windows 구분자)', () => {
		const result = summarizeToolInput('Read', {
			file_path: 'D:\\work\\project\\tools\\monitor-page\\app\\main.py'
		});
		expect(result).toBe('main.py');
	});

	it('Grep/Glob: pattern 필드를 사용한다', () => {
		expect(summarizeToolInput('Grep', { pattern: 'TODO' })).toBe('TODO');
		expect(summarizeToolInput('Glob', { pattern: '**/*.ts' })).toBe('**/*.ts');
	});

	it('Task/Agent: description 필드를 사용한다', () => {
		expect(summarizeToolInput('Task', { description: '버그 조사' })).toBe('버그 조사');
		expect(summarizeToolInput('Agent', { description: '리뷰 실행' })).toBe('리뷰 실행');
	});

	it('알 수 없는 도구는 input의 첫 번째 문자열 값을 사용한다', () => {
		const result = summarizeToolInput('UnknownTool', { foo: 123, bar: 'first string value' });
		expect(result).toBe('first string value');
	});

	it('알 수 없는 도구에서 문자열 필드가 전혀 없으면 null을 반환한다', () => {
		const result = summarizeToolInput('UnknownTool', { foo: 123, baz: true });
		expect(result).toBeNull();
	});

	it('알려진 도구라도 대상 필드가 비어 있으면 null을 반환한다', () => {
		expect(summarizeToolInput('Bash', {})).toBeNull();
		expect(summarizeToolInput('Read', { file_path: '' })).toBeNull();
		expect(summarizeToolInput('Grep', { other: 'x' })).toBeNull();
	});

	it('input이 없거나 객체가 아니면 null을 반환한다', () => {
		expect(summarizeToolInput('Bash', undefined)).toBeNull();
		expect(summarizeToolInput('Bash', null)).toBeNull();
		expect(summarizeToolInput('Bash', 'not-an-object')).toBeNull();
		expect(summarizeToolInput('Bash', ['array', 'is', 'not', 'object'])).toBeNull();
	});

	it('60자를 초과하면 잘라내고 말줄임표(…)를 붙인다', () => {
		const longCommand = 'x'.repeat(100);
		const result = summarizeToolInput('Bash', { command: longCommand });
		expect(result).not.toBeNull();
		expect(result!.length).toBeLessThanOrEqual(60);
		expect(result!.endsWith('…')).toBe(true);
	});

	it('60자 이하이면 말줄임표를 붙이지 않는다', () => {
		const shortCommand = 'echo hello';
		const result = summarizeToolInput('Bash', { command: shortCommand });
		expect(result).toBe('echo hello');
		expect(result!.endsWith('…')).toBe(false);
	});

	it('개행이 포함된 값은 공백으로 접혀 한 줄로 표시된다', () => {
		const result = summarizeToolInput('Bash', {
			description: '첫 줄\n두 번째 줄\n\n세 번째 줄'
		});
		expect(result).toBe('첫 줄 두 번째 줄 세 번째 줄');
		expect(result).not.toContain('\n');
	});

	it('탭/연속 공백도 단일 공백으로 접힌다', () => {
		const result = summarizeToolInput('Bash', { description: '  여러   공백\t탭  ' });
		expect(result).toBe('여러 공백 탭');
	});
});
