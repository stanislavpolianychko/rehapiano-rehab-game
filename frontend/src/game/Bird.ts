import type { FlyingProperties, BoundingBox } from '../types';
import { sounds } from '../Assets';
import { wait, toRad } from '../utils';
import { gameDebugger } from '../debug';

export class Bird {
    protected domElement: HTMLElement;
    protected flyingProperties: FlyingProperties;
    protected width!: number;
    protected height!: number;
    protected velocity!: number;
    protected position!: number;
    protected rotation!: number;
    protected controlVelocity: number = 0;
    public box!: BoundingBox;

    constructor(domElement: HTMLElement, flyingProperties: FlyingProperties) {
        this.domElement = domElement;
        this.flyingProperties = flyingProperties;
        this.reset();
    }

    public reset() {
        this.width = 34;
        this.height = 24;
        this.velocity = 0;
        this.position = 180;
        this.rotation = 0;
        this.controlVelocity = 0;
        this.box = { x: 60, y: 180, width: 34, height: 24 };
    }

    public jump() {
        // Jump is disabled - using continuous control instead
    }

    public setControlVelocity(velocity: number): void {
        this.controlVelocity = velocity;
    }

    public async die() {
        this.domElement.style.transition = `
            transform 1s cubic-bezier(0.65, 0, 0.35, 1)
        `;
        this.position = this.flyingProperties.flightAreaBox.height - this.height;
        this.rotation = 90;

        sounds.hit.play();
        await wait(500);
        sounds.die.play();
        await wait(500);
        this.domElement.style.transition = '';
    }

    public tick() {
        this.velocity = this.controlVelocity;
        this.rotation = Math.min((this.velocity / 10) * 90, 90);
        this.position += this.velocity;

        if (this.position < 0) {
            this.position = 0;
        }

        if (this.position > this.flyingProperties.flightAreaBox.height) {
            this.position = this.flyingProperties.flightAreaBox.height;
        }

        const rotationInRadians = Math.abs(toRad(this.rotation));
        const widthMultiplier = this.height - this.width;
        const heightMultiplier = this.width - this.height;

        this.box.width = this.width + (widthMultiplier * Math.sin(rotationInRadians));
        this.box.height = this.height + (heightMultiplier * Math.sin(rotationInRadians));

        const xShift = (this.width - this.box.width) / 2;
        const yShift = (this.height - this.box.height) / 2;

        this.box.x = 60 + xShift;
        this.box.y = this.position + yShift + this.flyingProperties.flightAreaBox.y;
    }

    public draw() {
        gameDebugger.drawBox(this.domElement, this.box);

        this.domElement.style.transform = `
            translate3d(0px, ${this.position}px, 0px)
            rotate3d(0, 0, 1, ${this.rotation}deg)
        `;
    }
}
