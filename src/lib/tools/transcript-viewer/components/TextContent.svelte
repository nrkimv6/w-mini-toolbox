<script lang="ts">
	import { getContext, tick } from 'svelte';
	import { marked } from 'marked';
	import DOMPurify from 'dompurify';
	import { SEARCH_CONTEXT_KEY, type SearchContext } from '../search.js';

	interface Props {
		text: string;
	}

	let { text }: Props = $props();

	// +page.svelte(setContext)가 제공하는 검색 상태. MessageBlock을 거쳐 내려오지만
	// context는 트리 전체에 전파되므로 MessageBlock에 prop 드릴링을 추가할 필요가 없다.
	// context provider가 없는 경우(단독 렌더/스토리북 등)를 대비해 optional로 처리한다.
	const searchCtx = getContext<SearchContext | undefined>(SEARCH_CONTEXT_KEY);

	let containerEl = $state<HTMLDivElement | undefined>(undefined);

	const html = $derived.by(() => {
		if (!text) return '';
		const raw = marked.parse(text, { async: false }) as string;
		// transcript는 신뢰할 수 없는 외부/사용자 콘텐츠를 포함하므로 반드시 sanitize한다.
		return DOMPurify.sanitize(raw);
	});

	/**
	 * 렌더된 DOM의 텍스트 노드를 순회하며 검색어 매칭 구간을 <mark>로 감싼다.
	 * 마크다운 원문 문자열에 <mark>를 주입하지 않고 렌더 후 실제 DOM 노드를 조작하는 이유:
	 * 원문에 주입하면 코드블록 안의 `<mark>` 텍스트가 파싱을 깨뜨리거나, 이미 sanitize된
	 * HTML 문자열에 재주입 시 XSS 표면이 다시 열릴 수 있기 때문이다.
	 */
	function highlightMatches(root: HTMLElement, query: string) {
		const needle = query.trim().toLowerCase();
		if (!needle) return;
		const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
		const targets: Text[] = [];
		let node: Node | null;
		while ((node = walker.nextNode())) {
			const tn = node as Text;
			if (tn.textContent && tn.textContent.toLowerCase().includes(needle)) {
				targets.push(tn);
			}
		}
		for (const tn of targets) {
			const original = tn.textContent ?? '';
			const lower = original.toLowerCase();
			const frag = document.createDocumentFragment();
			let cursor = 0;
			let idx = lower.indexOf(needle, cursor);
			while (idx !== -1) {
				if (idx > cursor) frag.appendChild(document.createTextNode(original.slice(cursor, idx)));
				const mark = document.createElement('mark');
				mark.className = 'transcript-search-mark';
				mark.textContent = original.slice(idx, idx + needle.length);
				frag.appendChild(mark);
				cursor = idx + needle.length;
				idx = lower.indexOf(needle, cursor);
			}
			if (cursor < original.length) frag.appendChild(document.createTextNode(original.slice(cursor)));
			tn.parentNode?.replaceChild(frag, tn);
		}
	}

	$effect(() => {
		// html(마크다운 렌더 결과) 또는 검색어가 바뀔 때마다 하이라이트를 다시 적용한다.
		// html을 읽어야 {@html html} 갱신 이후 재실행되는 의존성이 성립한다.
		void html;
		const query = searchCtx?.query ?? '';
		tick().then(() => {
			if (containerEl) highlightMatches(containerEl, query);
		});
	});
</script>

<div bind:this={containerEl} class="transcript-markdown prose prose-sm max-w-none break-words">
	{@html html}
</div>

<style>
	.transcript-markdown :global(p) {
		margin: 0 0 0.5rem 0;
	}
	.transcript-markdown :global(p:last-child) {
		margin-bottom: 0;
	}
	.transcript-markdown :global(pre) {
		background: hsl(220 20% 10%);
		color: hsl(220 20% 95%);
		padding: 0.75rem;
		border-radius: 0.375rem;
		overflow-x: auto;
		font-size: 0.8rem;
	}
	.transcript-markdown :global(code) {
		font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', 'SFMono-Regular', 'Consolas', monospace;
		font-size: 0.85em;
	}
	.transcript-markdown :global(pre code) {
		background: none;
		padding: 0;
	}
	.transcript-markdown :global(:not(pre) > code) {
		background: hsl(280 60% 70% / 0.12);
		padding: 0.1rem 0.3rem;
		border-radius: 0.25rem;
	}
	.transcript-markdown :global(ul),
	.transcript-markdown :global(ol) {
		padding-left: 1.25rem;
		margin: 0 0 0.5rem 0;
	}
	.transcript-markdown :global(a) {
		color: hsl(280 60% 50%);
	}
	.transcript-markdown :global(mark.transcript-search-mark) {
		background: hsl(50 100% 55% / 0.65);
		color: inherit;
		border-radius: 0.15rem;
		padding: 0 0.05rem;
	}
</style>
