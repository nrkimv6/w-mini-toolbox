<script lang="ts">
	// Phase 3 (item 14) — 마크다운 렌더 (기술·보안 요구, design prompt와 무관하게 성립)
	// transcript 본문은 신뢰할 수 없는 외부 콘텐츠이므로 marked → DOMPurify.sanitize를 반드시 거친다.
	// 하이라이트는 원문 문자열에 <mark>를 주입하지 않고, 렌더 후 TreeWalker로 텍스트 노드만 감싼다.
	// 구현 계약은 기존 transcript-viewer/components/TextContent.svelte(22~40행)와 동일하게 맞췄다
	// (컴포넌트는 import하지 않고 계약만 독립 재구현).
	//
	// 이 child에는 상세 내 검색 기능(P1, design prompt 134~142행)이 없으므로 `highlightQuery`를
	// 넘겨주는 호출부가 아직 없다(기본값 ''). 그래도 하이라이트 코드 경로 자체는 "원문 미주입 +
	// TreeWalker" 계약을 따르도록 미리 갖춰 둔다 — 이후 검색 기능이 추가될 때 안전한 하이라이트
	// 메커니즘을 재사용할 수 있게 하려는 선제 설계 결정이며, 현재는 호출되지 않아도 회귀가 아니다.
	import { tick } from 'svelte';
	import { marked } from 'marked';
	import DOMPurify from 'dompurify';

	let { text, highlightQuery = '' }: { text: string; highlightQuery?: string } = $props();

	let containerEl = $state<HTMLDivElement | undefined>(undefined);

	const html = $derived.by(() => {
		if (!text) return '';
		const raw = marked.parse(text, { async: false }) as string;
		// transcript는 신뢰할 수 없는 외부/사용자 콘텐츠를 포함하므로 반드시 sanitize한다.
		return DOMPurify.sanitize(raw);
	});

	/**
	 * 렌더된 DOM의 텍스트 노드를 순회하며 매칭 구간을 <mark>로 감싼다.
	 * 원문 문자열에 <mark>를 주입하지 않는 이유: 원문에 주입하면 코드블록 파싱이 깨지거나,
	 * 이미 sanitize된 HTML 문자열에 재주입할 경우 XSS 표면이 다시 열릴 수 있기 때문이다.
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
				mark.className = 'cse-text-mark';
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
		// html(마크다운 렌더 결과) 또는 하이라이트 질의가 바뀔 때마다 다시 적용한다.
		// html을 읽어야 {@html html} 갱신 이후 재실행되는 의존성이 성립한다.
		void html;
		const query = highlightQuery;
		tick().then(() => {
			if (containerEl) highlightMatches(containerEl, query);
		});
	});
</script>

<div bind:this={containerEl} class="cse-markdown prose prose-sm max-w-none break-words text-sm">
	{@html html}
</div>

<style>
	.cse-markdown :global(p) {
		margin: 0 0 0.5rem 0;
	}
	.cse-markdown :global(p:last-child) {
		margin-bottom: 0;
	}
	.cse-markdown :global(pre) {
		background: hsl(220 20% 10%);
		color: hsl(220 20% 95%);
		padding: 0.75rem;
		border-radius: 0.375rem;
		overflow-x: auto;
		font-size: 0.75rem;
	}
	.cse-markdown :global(code) {
		font-family: 'JetBrains Mono Variable', ui-monospace, SFMono-Regular, Menlo, monospace;
		font-size: 0.85em;
	}
	.cse-markdown :global(pre code) {
		background: none;
		padding: 0;
	}
	.cse-markdown :global(:not(pre) > code) {
		background: hsl(280 60% 70% / 0.12);
		padding: 0.1rem 0.3rem;
		border-radius: 0.25rem;
	}
	.cse-markdown :global(ul),
	.cse-markdown :global(ol) {
		padding-left: 1.25rem;
		margin: 0 0 0.5rem 0;
	}
	.cse-markdown :global(a) {
		color: hsl(280 60% 50%);
	}
	.cse-markdown :global(mark.cse-text-mark) {
		background: hsl(50 100% 55% / 0.65);
		color: inherit;
		border-radius: 0.15rem;
		padding: 0 0.05rem;
	}
</style>
