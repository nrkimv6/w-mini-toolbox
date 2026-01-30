<script lang="ts">
	import { page } from '$app/stores';
</script>

<div class="flex min-h-screen items-center justify-center">
	<div class="text-center">
		<h1 class="text-4xl font-bold">{$page.status}</h1>
		<p class="mt-2 text-gray-600">{$page.error?.message}</p>
		<a href="/" class="mt-4 inline-block text-blue-600 hover:underline">홈으로</a>
	</div>
</div>
