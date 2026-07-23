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
		id: 'claude-sessions',
		name: 'Claude Code Session Explorer',
		description: 'Claude Code 세션 로그(.jsonl) 폴더를 훑어보기',
		icon: 'FolderOpen',
		href: '/claude-sessions'
	}
];
