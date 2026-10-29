// @vitest-environment jsdom
import { render } from '@testing-library/svelte';
import { VideoState } from '@svelteframe/core';
import type { Component } from 'svelte';
import { describe, expect, it } from 'vitest';
import { Arrow, Circle, Ellipse, Line, Polygon, Rect, Star, Triangle } from './index.js';
import ShapeHarness from './ShapeHarness.test.svelte';

const video = new VideoState({ fps: 30, width: 1920, height: 1080, durationInFrames: 90 });

const inCanvas = (shape: Component<any>, props: Record<string, unknown>) =>
	render(ShapeHarness, { shape, shapeProps: props, video, canvas: true }).container;
const alone = (shape: Component<any>, props: Record<string, unknown>) =>
	render(ShapeHarness, { shape, shapeProps: props, video, canvas: false }).container;

const attrs = (element: Element | null) => Object.fromEntries([...(element?.attributes ?? [])].map((a) => [a.name, a.value]));

describe('<Canvas>', () => {
	it('is the size of the composition, in its pixels', () => {
		const svg = inCanvas(Rect, { width: 10, height: 10 }).querySelector('svg')!;
		expect(svg.getAttribute('width')).toBe('1920');
		expect(svg.getAttribute('height')).toBe('1080');
		expect(svg.getAttribute('viewBox')).toBe('0 0 1920 1080');
		expect(svg.getAttribute('class')).toBe('canvas');
		expect(svg.style.position).toBe('absolute');
		expect(svg.style.color).toBe('red');
		expect(svg.getAttribute('aria-hidden')).toBe('true');
	});

	it('draws a shape as a group, with no svg of its own', () => {
		const container = inCanvas(Rect, { width: 10, height: 10 });
		expect(container.querySelectorAll('svg')).toHaveLength(1);
		expect(container.querySelector('svg > g > rect')).not.toBeNull();
	});

	it('places a shape by x and y, with the top-left corner there by default', () => {
		const group = inCanvas(Rect, { x: 300, y: 200, width: 100, height: 50 }).querySelector('g')!;
		expect(group.getAttribute('transform')).toBe('translate(300 200)');
	});

	it('places a shape by any of its anchors', () => {
		const group = inCanvas(Circle, { x: 960, y: 540, radius: 100, anchor: 'center' }).querySelector('g')!;
		expect(group.getAttribute('transform')).toBe('translate(860 440)');
	});

	it('leaves a shape alone that is where it is drawn', () => {
		expect(inCanvas(Rect, { width: 10, height: 10 }).querySelector('g')!.hasAttribute('transform')).toBe(false);
	});

	it('passes class and style to the shape', () => {
		const group = inCanvas(Rect, { width: 10, height: 10, class: 'box', style: 'mix-blend-mode:screen' }).querySelector('g')!;
		expect(group.getAttribute('class')).toBe('box');
		expect((group as SVGGElement).style.mixBlendMode).toBe('screen');
	});
});

describe('a shape outside a <Canvas>', () => {
	it('is an svg of its own, as big as its box, that CSS can place', () => {
		const svg = alone(Rect, { width: 120, height: 60, x: 999, y: 999 }).querySelector('svg')!;
		expect(attrs(svg)).toMatchObject({ width: '120', height: '60', viewBox: '0 0 120 60' });
		expect(svg.style.display).toBe('block');
		expect(svg.style.overflow).toBe('visible');
		// x and y are for a canvas; here the element is where the page puts it.
		expect(svg.querySelector('g')!.hasAttribute('transform')).toBe(false);
	});

	it('still rotates and scales', () => {
		const group = alone(Rect, { width: 100, height: 50, rotate: 90 }).querySelector('svg > g')!;
		expect(group.getAttribute('transform')).toBe('translate(50 25) rotate(90) translate(-50 -25)');
	});
});

describe('Rect', () => {
	it('draws a rectangle with its paint', () => {
		const rect = inCanvas(Rect, { width: 400, height: 200, radius: 24, fill: '#ff3e00', stroke: '#fff', strokeWidth: 6, opacity: 0.8 }).querySelector('rect')!;
		expect(attrs(rect)).toEqual({ width: '400', height: '200', rx: '24', fill: '#ff3e00', stroke: '#fff', 'stroke-width': '6', opacity: '0.8' });
	});

	it('leaves paint to SVG when not given, and has no corners by default', () => {
		expect(attrs(inCanvas(Rect, { width: 5, height: 6 }).querySelector('rect'))).toEqual({ width: '5', height: '6' });
	});

	it('limits the corner radius to half the shorter side', () => {
		expect(inCanvas(Rect, { width: 100, height: 40, radius: 500 }).querySelector('rect')!.getAttribute('rx')).toBe('20');
	});

	it('draws only part of the outline with progress', () => {
		const rect = inCanvas(Rect, { width: 10, height: 10, stroke: 'white', progress: 0.4 }).querySelector('rect')!;
		expect(rect.getAttribute('pathLength')).toBe('1');
		expect(rect.getAttribute('stroke-dasharray')).toBe('0.4 1');
		const done = inCanvas(Rect, { width: 10, height: 10, stroke: 'white', progress: 1 }).querySelector('rect')!;
		expect(done.hasAttribute('stroke-dasharray')).toBe(false);
		expect(done.hasAttribute('pathLength')).toBe(false);
	});

	it('rejects sizes that cannot be drawn', () => {
		expect(() => inCanvas(Rect, { width: -1, height: 5 })).toThrow('width must be 0 or more');
		expect(() => inCanvas(Rect, { width: 1, height: Number.NaN })).toThrow('height must be 0 or more');
		expect(() => inCanvas(Rect, { width: 1, height: 1, radius: -2 })).toThrow('radius must be 0 or more');
	});
});

describe('Circle and Ellipse', () => {
	it('have a box around them, so the centre is at the radius', () => {
		const container = inCanvas(Circle, { x: 500, y: 400, radius: 80 });
		expect(attrs(container.querySelector('circle'))).toEqual({ cx: '80', cy: '80', r: '80' });
		expect(container.querySelector('g')!.getAttribute('transform')).toBe('translate(500 400)');
	});

	it('draw an ellipse by its two radii', () => {
		const container = inCanvas(Ellipse, { x: 100, y: 100, rx: 60, ry: 30, anchor: 'center', fill: 'blue' });
		expect(attrs(container.querySelector('ellipse'))).toEqual({ cx: '60', cy: '30', rx: '60', ry: '30', fill: 'blue' });
		expect(container.querySelector('g')!.getAttribute('transform')).toBe('translate(40 70)');
	});

	it('size the standalone svg from the radii', () => {
		expect(attrs(alone(Circle, { radius: 25 }).querySelector('svg'))).toMatchObject({ width: '50', height: '50' });
		expect(attrs(alone(Ellipse, { rx: 25, ry: 10 }).querySelector('svg'))).toMatchObject({ width: '50', height: '20' });
	});

	it('reject a negative radius', () => {
		expect(() => inCanvas(Circle, { radius: -1 })).toThrow('radius must be 0 or more');
		expect(() => inCanvas(Ellipse, { rx: 1, ry: -1 })).toThrow('ry must be 0 or more');
	});
});

describe('Polygon, Star and Triangle', () => {
	it('draw a polygon with a corner up, centred in a box twice the radius', () => {
		const container = inCanvas(Polygon, { sides: 4, radius: 10, fill: 'red' });
		expect(container.querySelector('polygon')!.getAttribute('points')).toBe('10,0 20,10 10,20 0,10');
		expect(attrs(alone(Polygon, { sides: 6, radius: 30 }).querySelector('svg'))).toMatchObject({ width: '60', height: '60' });
	});

	it('draw a star with tips and notches', () => {
		const points = inCanvas(Star, { outerRadius: 100 }).querySelector('polygon')!.getAttribute('points')!.split(' ');
		expect(points).toHaveLength(10);
		expect(points[0]).toBe('100,0');
	});

	it('take the number of points and the inner radius of a star', () => {
		const points = inCanvas(Star, { points: 4, outerRadius: 10, innerRadius: 5 }).querySelector('polygon')!.getAttribute('points');
		expect(points).toBe('10,0 13.5355,6.4645 20,10 13.5355,13.5355 10,20 6.4645,13.5355 0,10 6.4645,6.4645');
	});

	it('draw a triangle pointing up in its box', () => {
		const container = inCanvas(Triangle, { x: 10, y: 20, width: 80, height: 60 });
		expect(container.querySelector('polygon')!.getAttribute('points')).toBe('40,0 80,60 0,60');
		expect(container.querySelector('g')!.getAttribute('transform')).toBe('translate(10 20)');
	});

	it('round the joins by default, and take another', () => {
		expect(inCanvas(Triangle, { width: 1, height: 1 }).querySelector('polygon')!.getAttribute('stroke-linejoin')).toBe('round');
		expect(inCanvas(Star, { outerRadius: 5, strokeLinejoin: 'miter' }).querySelector('polygon')!.getAttribute('stroke-linejoin')).toBe('miter');
	});

	it('reject what cannot be drawn', () => {
		expect(() => inCanvas(Polygon, { sides: 2, radius: 10 })).toThrow('3 or more sides');
		expect(() => inCanvas(Star, { points: 2, outerRadius: 10 })).toThrow('3 or more points');
		expect(() => inCanvas(Triangle, { width: -1, height: 1 })).toThrow('width must be 0 or more');
	});
});

describe('Line', () => {
	it('draws between its two points, in canvas pixels', () => {
		const container = inCanvas(Line, { from: [100, 300], to: [400, 100], stroke: 'white', strokeWidth: 6 });
		// The group is put at the corner of the box around the line, and the line is drawn inside it.
		expect(container.querySelector('g')!.getAttribute('transform')).toBe('translate(100 100)');
		expect(attrs(container.querySelector('line'))).toEqual({ x1: '0', y1: '200', x2: '300', y2: '0', stroke: 'white', 'stroke-width': '6' });
	});

	it('is visible without any styling', () => {
		expect(attrs(inCanvas(Line, { from: [0, 0], to: [10, 0] }).querySelector('line'))).toMatchObject({ stroke: 'currentColor', 'stroke-width': '4' });
	});

	it('draws from the start towards the end with progress', () => {
		const line = inCanvas(Line, { from: [0, 0], to: [200, 100], progress: 0.5 }).querySelector('line')!;
		expect(attrs(line)).toMatchObject({ x1: '0', y1: '0', x2: '100', y2: '50' });
		expect(inCanvas(Line, { from: [0, 0], to: [200, 100], progress: 0 }).querySelector('line')).toBeNull();
	});

	it('is an svg as big as the box around it when outside a canvas', () => {
		const svg = alone(Line, { from: [100, 100], to: [160, 140] }).querySelector('svg')!;
		expect(attrs(svg)).toMatchObject({ width: '60', height: '40' });
		expect(attrs(svg.querySelector('line'))).toMatchObject({ x1: '0', y1: '0', x2: '60', y2: '40' });
	});

	it('can be rotated', () => {
		const group = inCanvas(Line, { from: [0, 0], to: [100, 0], rotate: 90 }).querySelector('g')!;
		expect(group.getAttribute('transform')).toBe('translate(50 0) rotate(90) translate(-50 0)');
	});
});

describe('Arrow', () => {
	it('draws a shaft and a head the colour of the stroke', () => {
		const container = inCanvas(Arrow, { from: [100, 200], to: [300, 200], stroke: '#fff', strokeWidth: 10 });
		expect(attrs(container.querySelector('line'))).toEqual({ x1: '0', y1: '0', x2: '160', y2: '0', stroke: '#fff', 'stroke-width': '10' });
		const head = container.querySelector('polygon')!;
		// 40 long, 32 wide; its tip is the end of the arrow.
		expect(head.getAttribute('points')).toBe('200,0 160,16 160,-16');
		expect(attrs(head)).toMatchObject({ fill: '#fff', stroke: '#fff', 'stroke-width': '0' });
		expect(container.querySelector('g')!.getAttribute('transform')).toBe('translate(100 200)');
	});

	it('takes the size of its head, and where the heads are', () => {
		const container = inCanvas(Arrow, { from: [0, 0], to: [200, 0], headLength: 30, headWidth: 10, heads: 'both' });
		const polygons = [...container.querySelectorAll('polygon')];
		expect(polygons.map((p) => p.getAttribute('points'))).toEqual(['0,0 30,-5 30,5', '200,0 170,5 170,-5']);
		expect(attrs(container.querySelector('line'))).toMatchObject({ x1: '30', x2: '170' });
	});

	it('has no head with heads none', () => {
		const container = inCanvas(Arrow, { from: [0, 0], to: [100, 0], heads: 'none' });
		expect(container.querySelector('polygon')).toBeNull();
		expect(attrs(container.querySelector('line'))).toMatchObject({ x2: '100' });
	});

	it('grows from its start, the head going with the tip', () => {
		const half = inCanvas(Arrow, { from: [0, 0], to: [200, 0], strokeWidth: 5, progress: 0.5 });
		expect(half.querySelector('polygon')!.getAttribute('points')).toMatch(/^100,0 /);
		expect(attrs(half.querySelector('line'))).toMatchObject({ x2: '80' });

		const none = inCanvas(Arrow, { from: [0, 0], to: [200, 0], progress: 0 });
		expect(none.querySelector('line')).toBeNull();
		expect(none.querySelector('polygon')).toBeNull();
	});

	it('points along any direction', () => {
		const container = inCanvas(Arrow, { from: [100, 100], to: [100, 0], strokeWidth: 5 });
		// Up the page: the tip is at the top of the box.
		expect(container.querySelector('polygon')!.getAttribute('points')).toMatch(/^0,0 /);
		expect(container.querySelector('g')!.getAttribute('transform')).toBe('translate(100 0)');
	});

	it('is an svg of its own when outside a canvas', () => {
		const svg = alone(Arrow, { from: [50, 50], to: [150, 50] }).querySelector('svg')!;
		expect(attrs(svg)).toMatchObject({ width: '100', height: '0' });
		expect(svg.querySelector('polygon')).not.toBeNull();
	});
});
