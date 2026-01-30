export interface AttributeFilter {
	id: boolean;
	class: boolean;
	dataAttributes: boolean;
	style: boolean;
	href: boolean;
	src: boolean;
	alt: boolean;
	title: boolean;
	width: boolean;
	height: boolean;
	customPatterns: string[];
}

export interface AttributePreset {
	name: string;
	description: string;
	filters: AttributeFilter;
}

export const DEFAULT_ATTRIBUTE_FILTER: AttributeFilter = {
	id: false,
	class: false,
	dataAttributes: false,
	style: false,
	href: true,
	src: true,
	alt: true,
	title: true,
	width: false,
	height: false,
	customPatterns: []
};

export const ATTRIBUTE_PRESETS: AttributePreset[] = [
	{
		name: '최소 변환',
		description: '모든 속성 제거 (텍스트만 추출)',
		filters: {
			id: false,
			class: false,
			dataAttributes: false,
			style: false,
			href: false,
			src: false,
			alt: false,
			title: false,
			width: false,
			height: false,
			customPatterns: []
		}
	},
	{
		name: '콘텐츠 중심',
		description: '링크와 이미지 정보만 유지',
		filters: {
			id: false,
			class: false,
			dataAttributes: false,
			style: false,
			href: true,
			src: true,
			alt: true,
			title: true,
			width: false,
			height: false,
			customPatterns: []
		}
	},
	{
		name: '완전 보존',
		description: '모든 속성 유지',
		filters: {
			id: true,
			class: true,
			dataAttributes: true,
			style: true,
			href: true,
			src: true,
			alt: true,
			title: true,
			width: true,
			height: true,
			customPatterns: []
		}
	}
];