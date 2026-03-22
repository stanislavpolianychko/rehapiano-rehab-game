import type { BoundingBox } from '../types';
import { Pipe } from './Pipe';
import { gameDebugger } from '../debug';

export class PipeManager {
    protected pipeAreaDomElement: HTMLElement;
    protected pipeDelay = 5000;
    protected lastPipeInsertedTimestamp = 0;
    protected pipes: Pipe[] = [];
    protected easyMode;
    protected currentGap: number = 140;

    constructor(pipeAreaDomElement: HTMLElement, easyMode: boolean = false) {
        this.pipeAreaDomElement = pipeAreaDomElement;
        this.easyMode = easyMode;
        this.currentGap = easyMode ? 140 : 90;
    }

    public setPipeDelay(delay: number): void {
        this.pipeDelay = delay;
    }

    public setPipeGap(gap: number): void {
        this.currentGap = gap;
    }

    public tick(now: number) {
        this.pipes.forEach(pipe => pipe.tick());

        if (now - this.lastPipeInsertedTimestamp < this.pipeDelay) {
            return;
        }

        gameDebugger.log('inserting pipe after', now - this.lastPipeInsertedTimestamp, 'ms');
        this.lastPipeInsertedTimestamp = now;
        const pipeDimension = this.createPipeDimensions({
            gap: this.currentGap,
        });
        const pipe = new Pipe(pipeDimension);
        this.pipes.push(pipe);
        this.pipeAreaDomElement.appendChild(pipe.domElement);

        this.pipes = this.pipes.filter(pipe => {
            if (pipe.isOffScreen()) {
                gameDebugger.log('pruning a pipe');
                pipe.domElement.remove();
                return false;
            }

            return true;
        });
    }

    public intersectsWith(box: BoundingBox) {
        return this.pipes.find(pipe => pipe.intersectsWith(box)) != null;
    }

    public removeAll() {
        this.pipes.forEach(pipe => pipe.domElement.remove());
        this.pipes = [];
    }

    public nextUnscoredPipe() {
        return this.pipes.find(pipe => pipe.scored === false);
    }

    protected createPipeDimensions(options: { gap: number }) {
        const topPipeBuffer = 80;
        const bottomPipeBuffer = 420 - options.gap - topPipeBuffer;
        const topPipeHeight = this.randomNumberBetween(topPipeBuffer, bottomPipeBuffer);
        const bottomPipeHeight = 420 - options.gap - topPipeHeight;
        return { topPipeHeight, bottomPipeHeight };
    }

    protected randomNumberBetween(min: number, max: number) {
        return Math.floor(Math.random() * (max - min + 1)) + min;
    }
}
