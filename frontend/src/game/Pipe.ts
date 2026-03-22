import type { BoundingBox } from '../types';
import { isBoxIntersecting } from '../utils';
import { gameDebugger } from '../debug';

export class Pipe {
    public scored = false;
    public domElement: HTMLDivElement;
    protected upperPipeDomElement: HTMLDivElement;
    protected lowerPipeDomElement: HTMLDivElement;
    protected upperBox: BoundingBox = { x: 0, y: 0, width: 0, height: 0 };
    protected lowerBox: BoundingBox = { x: 0, y: 0, width: 0, height: 0 };

    constructor(options: { topPipeHeight: number; bottomPipeHeight: number }) {
        this.domElement = document.createElement('div');
        this.domElement.className = 'pipe animated';

        this.upperPipeDomElement = document.createElement('div');
        this.upperPipeDomElement.className = 'pipe_upper';
        this.upperPipeDomElement.style.height = `${options.topPipeHeight}px`;

        this.lowerPipeDomElement = document.createElement('div');
        this.lowerPipeDomElement.className = 'pipe_lower';
        this.lowerPipeDomElement.style.height = `${options.bottomPipeHeight}px`;

        this.domElement.appendChild(this.upperPipeDomElement);
        this.domElement.appendChild(this.lowerPipeDomElement);
    }

    public isOffScreen() {
        return this.upperBox.x <= -100;
    }

    public hasCrossed(box: BoundingBox) {
        return this.upperBox.width !== 0 && this.upperBox.x + this.upperBox.width <= box.x;
    }

    public intersectsWith(box: BoundingBox) {
        return isBoxIntersecting(this.upperBox, box) || isBoxIntersecting(this.lowerBox, box);
    }

    public tick() {
        this.upperBox = this.upperPipeDomElement.getBoundingClientRect();
        this.lowerBox = this.lowerPipeDomElement.getBoundingClientRect();

        gameDebugger.drawBox(this.upperPipeDomElement, this.upperBox);
        gameDebugger.drawBox(this.lowerPipeDomElement, this.lowerBox);
    }
}
