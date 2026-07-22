export interface Tool {
	id: string;
	name: string;
	description: string;
	icon: string;
	href: string;
}

export const tools: Tool[] = [
	{
		id: 'html-to-md',
		name: 'HTML → Markdown',
		description: 'HTML을 깔끔한 마크다운으로 변환',
		icon: 'FileText',
		href: '/html-to-md'
	},
	{
		id: 'screenshot',
		name: 'Screenshot Mockup',
		description: '모바일 디바이스 프레임 목업 생성',
		icon: 'Smartphone',
		href: '/screenshot'
	},
	{
		id: 'transcript-viewer',
		name: 'Transcript Viewer',
		description: 'Claude Code 세션(.jsonl) 뷰어',
		icon: 'ScrollText',
		href: '/transcript'
	}
];
