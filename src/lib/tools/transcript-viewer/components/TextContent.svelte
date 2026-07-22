<script lang="ts">
	import { marked } from 'marked';
	import DOMPurify from 'dompurify';

	interface Props {
		text: string;
	}

	let { text }: Props = $props();

	function renderMarkdown(raw: string): string {
		if (!raw) return '';
		const html = marked.parse(raw, { async: false }) as string;
		// transcript는 신뢰할 수 없는 외부/사용자 콘텐츠를 포함하므로 반드시 sanitize한다.
		return DOMPurify.sanitize(html);
	}
</script>

<div class="transcript-markdown prose prose-sm max-w-none break-words">
	{@html renderMarkdown(text)}
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
</style>
