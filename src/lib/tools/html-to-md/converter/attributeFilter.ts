import type { AttributeFilter } from '$lib/types/attributeFilter.js';

/**
 * Preprocess HTML by filtering attributes based on user preferences
 */
export function preprocessHTML(html: string, filters: AttributeFilter): string {
	if (!html.trim()) return html;
	
	// Create a temporary DOM element to parse HTML
	const parser = new DOMParser();
	const doc = parser.parseFromString(html, 'text/html');
	
	// Process all elements
	const allElements = doc.querySelectorAll('*');
	allElements.forEach(element => {
		const attributesToRemove: string[] = [];
		
		// Check each attribute
		for (let i = 0; i < element.attributes.length; i++) {
			const attr = element.attributes[i];
			const shouldKeep = shouldKeepAttribute(attr.name, attr.value, filters);
			
			if (!shouldKeep) {
				attributesToRemove.push(attr.name);
			}
		}
		
		// Remove attributes after iteration to avoid modifying collection during iteration
		attributesToRemove.forEach(attrName => {
			element.removeAttribute(attrName);
		});
	});
	
	// Return the processed HTML
	return doc.body.innerHTML;
}

/**
 * Determine if an attribute should be kept based on filters
 */
function shouldKeepAttribute(name: string, value: string, filters: AttributeFilter): boolean {
	// Always keep essential attributes for certain elements
	const essentialAttributes: Record<string, string[]> = {
		'a': ['href'],
		'img': ['src', 'alt'],
		'video': ['src'],
		'audio': ['src'],
		'source': ['src', 'srcset'],
		'iframe': ['src'],
	};
	
	// Check standard attributes
	switch (name.toLowerCase()) {
		case 'id':
			return filters.id;
		case 'class':
		case 'classname':
			return filters.class;
		case 'style':
			return filters.style;
		case 'href':
			return filters.href;
		case 'src':
		case 'srcset':
			return filters.src;
		case 'alt':
			return filters.alt;
		case 'title':
			return filters.title;
		case 'width':
			return filters.width;
		case 'height':
			return filters.height;
	}
	
	// Check data attributes
	if (name.startsWith('data-')) {
		return filters.dataAttributes;
	}
	
	// Check custom patterns
	if (filters.customPatterns.length > 0) {
		for (const pattern of filters.customPatterns) {
			try {
				const regex = new RegExp(pattern);
				if (regex.test(name)) {
					return true; // Keep if matches custom pattern
				}
			} catch (e) {
				console.error(`Invalid regex pattern: ${pattern}`, e);
			}
		}
	}
	
	// Check for Angular/React/Vue specific attributes to always remove
	const frameworkAttributes = [
		'_ngcontent',
		'_nghost',
		'ng-',
		'v-',
		':',
		'@',
		'x-'
	];
	
	for (const prefix of frameworkAttributes) {
		if (name.startsWith(prefix)) {
			return false;
		}
	}
	
	// Remove event handlers for security
	if (name.startsWith('on')) {
		return false;
	}
	
	// Keep unrecognized attributes by default (conservative approach)
	// You might want to change this to false for more aggressive filtering
	return false;
}

/**
 * Post-process markdown to add preserved attributes as comments if needed
 */
export function postProcessMarkdown(markdown: string, preservedAttributes: Map<string, any>): string {
	// This function can be extended to add HTML comments with preserved data-* attributes
	// For now, we'll just return the markdown as-is
	return markdown;
}

/**
 * Extract and store attributes that might be needed later
 */
export function extractImportantAttributes(html: string): Map<string, any> {
	const attributes = new Map();
	const parser = new DOMParser();
	const doc = parser.parseFromString(html, 'text/html');
	
	// Extract data attributes that might contain important metadata
	const elementsWithData = doc.querySelectorAll('[data-*]');
	elementsWithData.forEach((element, index) => {
		const dataAttrs: Record<string, string> = {};
		for (let i = 0; i < element.attributes.length; i++) {
			const attr = element.attributes[i];
			if (attr.name.startsWith('data-')) {
				dataAttrs[attr.name] = attr.value;
			}
		}
		if (Object.keys(dataAttrs).length > 0) {
			attributes.set(`element-${index}`, dataAttrs);
		}
	});
	
	return attributes;
}