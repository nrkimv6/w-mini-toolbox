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
	}
];
