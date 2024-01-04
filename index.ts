import cv, { Mat } from "opencv-ts";

export interface ScannerOptions {
  parent: HTMLDivElement;
  width?: number;
  height?: number;
  maxWidth?: number;
  maxHeight?: number;
  cornerRadius?: number;
  cornerColor?: string;
  cropBoxColor?: string;
  backdropColor?: string;
  minCropBoxWidth?: number;
  minCropBoxHeight?: number;
  cropBoxBorderWidth?: number;
  cropBoxBorderColor?: string;
  initialCorners?: { x: number; y: number }[];
}

export interface Position {
  x: number;
  y: number;
}

class Scanner {
  #parent: HTMLDivElement;
  #relativePostionedDiv: HTMLDivElement;
  #canvas: HTMLCanvasElement;
  #width?: number;
  #height?: number;
  #maxWidth?: number;
  #maxHeight?: number;
  #ctx: CanvasRenderingContext2D;
  #canvasBorderPoints!: Position[];
  #img: HTMLImageElement;
  #cornerRadius: number;
  #cornerColor: string;
  #cropBoxColor?: string;
  #backdropColor: string;
  #minCropBoxWidth: number;
  #minCropBoxHeight: number;
  #move: { active: boolean; prevTouch: Position };
  #corners!: Position[];
  #selectedCornerIndex: number;
  #overlayCanvas: HTMLCanvasElement;
  #overlayCtx: CanvasRenderingContext2D;
  #cropBoxBorderWidth: number;
  #cropBoxBorderColor: string;
  #initialCorners?: Position[];

  constructor(options: ScannerOptions) {
    const {
      parent,
      width,
      height,
      maxWidth,
      maxHeight,
      cornerRadius = 12,
      cornerColor = "lightgreen",
      cropBoxColor,
      backdropColor = "rgba(0, 0, 0, 0.5)",
      minCropBoxWidth,
      minCropBoxHeight,
      cropBoxBorderWidth = 1,
      cropBoxBorderColor = "rgba(255, 255, 255)",
      initialCorners,
    } = options;

    if ("backdropColor" in options && "cropBoxColor" in options) {
      throw new Error(
        "Only one of backdropColor or cropBoxColor is to be set."
      );
    }

    if (width && maxWidth) {
      throw new Error("Only one of width or maxWidth is to be set.");
    }

    if (height && maxHeight) {
      throw new Error("Only one of height or maxHeight is to be set.");
    }

    this.#img = new Image();
    this.#parent = parent;
    this.#canvas = document.createElement("canvas");
    if (width) this.#width = width;
    if (height) this.#height = height;
    if (maxWidth) this.#maxWidth = maxWidth;
    if (maxHeight) this.#maxHeight = maxHeight;
    this.#canvas.style.boxSizing = "content-box";
    this.#canvas.style.padding = `${cornerRadius}px`;
    this.#canvas.style.display = "block";
    this.#ctx = this.#canvas.getContext("2d", { willReadFrequently: true })!;
    this.#ctx.imageSmoothingEnabled = true;
    this.#cornerRadius = cornerRadius;
    this.#cornerColor = cornerColor;
    this.#cropBoxColor = cropBoxColor;
    this.#backdropColor = backdropColor;
    this.#minCropBoxWidth = minCropBoxWidth ?? 100;
    this.#minCropBoxHeight = minCropBoxHeight ?? 100;
    this.#cropBoxBorderWidth = cropBoxBorderWidth;
    this.#cropBoxBorderColor = cropBoxBorderColor;
    this.#initialCorners = initialCorners;
    this.#move = {
      active: false,
      prevTouch: {
        x: 0,
        y: 0,
      },
    };

    this.#selectedCornerIndex = -1;

    const relativePostionedDiv = document.createElement("div");
    relativePostionedDiv.style.position = "relative";
    this.#relativePostionedDiv = relativePostionedDiv;
    this.#overlayCanvas = document.createElement("canvas");
    this.#overlayCtx = this.#overlayCanvas.getContext("2d", {
      willReadFrequently: true,
    })!;
    this.#overlayCanvas.style.position = "absolute";
    this.#overlayCanvas.style.top = "0";
    this.#overlayCanvas.style.left = "0";
    this.#overlayCanvas.style.zIndex = "1";
    this.#overlayCanvas.addEventListener(
      "touchstart",
      this.#handleTouchStart.bind(this)
    );
    this.#overlayCanvas.addEventListener(
      "touchmove",
      this.#handleTouchMove.bind(this)
    );
    this.#overlayCanvas.addEventListener(
      "touchend",
      this.#handleTouchEnd.bind(this)
    );
    this.#overlayCanvas.addEventListener(
      "mousedown",
      this.#handleMouseDown.bind(this)
    );
    this.#overlayCanvas.addEventListener(
      "mousemove",
      this.#handleMouseMove.bind(this)
    );
    this.#overlayCanvas.addEventListener(
      "mouseup",
      this.#handleTouchEnd.bind(this)
    );

    this.#relativePostionedDiv.appendChild(this.#canvas);
    this.#relativePostionedDiv.appendChild(this.#overlayCanvas);
    this.#parent.appendChild(this.#relativePostionedDiv);
  }

  #initializeCanvasDimensions() {
    if (this.#width && !this.#height) {
      let x = this.#width;
      let y = Math.floor(
        (this.#width / this.#img.naturalWidth) * this.#img.naturalHeight
      );
      if (this.#maxHeight && y > this.#maxHeight) {
        y = this.#maxHeight;
        x = Math.floor(
          (this.#maxHeight / this.#img.naturalHeight) * this.#img.naturalWidth
        );
      }
      this.#canvas.width = x;
      this.#canvas.height = y;
      this.#canvasBorderPoints = [
        { x: this.#cornerRadius, y: this.#cornerRadius },
        {
          x: x + this.#cornerRadius,
          y: this.#cornerRadius,
        },
        {
          x: x + this.#cornerRadius,
          y: y + this.#cornerRadius,
        },
        {
          x: this.#cornerRadius,
          y: y + this.#cornerRadius,
        },
      ];
    } else if (this.#height && !this.#width) {
      let x = Math.floor(
        (this.#height / this.#img.naturalHeight) * this.#img.naturalWidth
      );
      let y = this.#height;
      if (this.#maxWidth && x > this.#maxWidth) {
        x = this.#maxWidth;
        y = Math.floor(
          (this.#maxWidth / this.#img.naturalWidth) * this.#img.naturalHeight
        );
      }
      this.#canvas.width = x;
      this.#canvas.height = y;
      this.#canvasBorderPoints = [
        { x: this.#cornerRadius, y: this.#cornerRadius },
        {
          x: x + this.#cornerRadius,
          y: this.#cornerRadius,
        },
        {
          x: x + this.#cornerRadius,
          y: y + this.#cornerRadius,
        },
        {
          x: this.#cornerRadius,
          y: y + this.#cornerRadius,
        },
      ];
    } else if (this.#width && this.#height) {
      this.#canvas.width = this.#width;
      this.#canvas.height = this.#height;
      this.#canvasBorderPoints = [
        { x: this.#cornerRadius, y: this.#cornerRadius },
        {
          x: this.#width + this.#cornerRadius,
          y: this.#cornerRadius,
        },
        {
          x: this.#width + this.#cornerRadius,
          y: this.#height + this.#cornerRadius,
        },
        {
          x: this.#cornerRadius,
          y: this.#height + this.#cornerRadius,
        },
      ];
    } else {
      if (this.#maxWidth && this.#maxHeight) {
        console.warn(
          "maxWidth and maxHeight are ignored when both width and height are not set. Image will be rendered in its original size."
        );
      }

      this.#canvas.width = this.#img.naturalWidth;
      this.#canvas.height = this.#img.naturalHeight;
      this.#canvasBorderPoints = [
        { x: this.#cornerRadius, y: this.#cornerRadius },
        {
          x: this.#img.naturalWidth + this.#cornerRadius,
          y: this.#cornerRadius,
        },
        {
          x: this.#img.naturalWidth + this.#cornerRadius,
          y: this.#img.naturalHeight + this.#cornerRadius,
        },
        {
          x: this.#cornerRadius,
          y: this.#img.naturalHeight + this.#cornerRadius,
        },
      ];
    }
    this.#canvas.style.width = `${this.#canvas.width}px`;
    this.#canvas.style.height = `${this.#canvas.height}px`;
    this.#overlayCanvas.width = this.#canvas.width + 2 * this.#cornerRadius;
    this.#overlayCanvas.height = this.#canvas.height + 2 * this.#cornerRadius;
    this.#canvas.width = this.#canvas.width * window.devicePixelRatio;
    this.#canvas.height = this.#canvas.height * window.devicePixelRatio;
  }

  #initializeCorners(initialCorners: Position[] | undefined | null) {
    if (initialCorners !== null && initialCorners !== undefined) {
      this.#corners = initialCorners.map((corner) => ({
        x:
          ((corner.x / 100) * this.#canvas.width) / window.devicePixelRatio +
          this.#cornerRadius,
        y:
          ((corner.y / 100) * this.#canvas.height) / window.devicePixelRatio +
          this.#cornerRadius,
      }));
    } else {
      this.#corners = [
        { x: this.#cornerRadius, y: this.#cornerRadius },
        {
          x: this.#canvas.width / window.devicePixelRatio + this.#cornerRadius,
          y: this.#cornerRadius,
        },
        {
          x: this.#canvas.width / window.devicePixelRatio + this.#cornerRadius,
          y: this.#canvas.height / window.devicePixelRatio + this.#cornerRadius,
        },
        {
          x: this.#cornerRadius,
          y: this.#canvas.height / window.devicePixelRatio + this.#cornerRadius,
        },
      ];
    }
  }

  #drawImage() {
    this.#ctx.drawImage(
      this.#img,
      0,
      0,
      this.#canvas.width,
      this.#canvas.height
    );
  }

  #drawCropBox() {
    this.#overlayCtx.clearRect(
      0,
      0,
      this.#overlayCanvas.width,
      this.#overlayCanvas.height
    );

    if (!this.#cropBoxColor) {
      this.#overlayCtx.fillStyle = this.#backdropColor;
      this.#overlayCtx.fillRect(
        this.#cornerRadius,
        this.#cornerRadius,
        this.#canvas.width / window.devicePixelRatio,
        this.#canvas.height / window.devicePixelRatio
      );
      this.#overlayCtx.globalCompositeOperation = "destination-out";
    } else this.#overlayCtx.fillStyle = this.#cropBoxColor;
    this.#overlayCtx.strokeStyle = this.#cropBoxBorderColor;
    this.#overlayCtx.lineWidth = this.#cropBoxBorderWidth;
    this.#overlayCtx.beginPath();
    this.#overlayCtx.moveTo(this.#corners[0].x, this.#corners[0].y);
    for (let i = 1; i < this.#corners.length; i++) {
      this.#overlayCtx.lineTo(this.#corners[i].x, this.#corners[i].y);
    }
    this.#overlayCtx.closePath();
    this.#overlayCtx.fill();

    this.#overlayCtx.globalCompositeOperation = "source-over";
    this.#overlayCtx.stroke();
    this.#overlayCtx.fillStyle = this.#cornerColor;
    this.#corners.forEach((corner) => {
      this.#overlayCtx.beginPath();
      this.#overlayCtx.arc(
        corner.x,
        corner.y,
        this.#cornerRadius,
        0,
        2 * Math.PI
      );
      this.#overlayCtx.fill();
    });

    this.#overlayCtx.beginPath();
    this.#overlayCtx.moveTo(this.#corners[0].x, this.#corners[0].y);
    for (let i = 1; i < this.#corners.length; i++) {
      this.#overlayCtx.lineTo(this.#corners[i].x, this.#corners[i].y);
    }
    this.#overlayCtx.closePath();
    this.#overlayCtx.stroke();
  }

  #isTouchInsideCropBox(touchX: number, touchY: number) {
    const touchOffset = 30;
    this.#overlayCtx.beginPath();
    this.#overlayCtx.moveTo(
      this.#corners[0].x + touchOffset,
      this.#corners[0].y + touchOffset
    );
    this.#overlayCtx.lineTo(
      this.#corners[1].x - touchOffset,
      this.#corners[1].y + touchOffset
    );
    this.#overlayCtx.lineTo(
      this.#corners[2].x - touchOffset,
      this.#corners[2].y - touchOffset
    );
    this.#overlayCtx.lineTo(
      this.#corners[3].x + touchOffset,
      this.#corners[3].y - touchOffset
    );
    this.#overlayCtx.closePath();
    return this.#overlayCtx.isPointInPath(touchX, touchY);
  }

  #getSelectedCornerIndex(mouseX: number, mouseY: number) {
    for (let i = 0; i < this.#corners.length; i++) {
      const corner = this.#corners[i];
      const distance = Math.sqrt(
        (mouseX - corner.x) ** 2 + (mouseY - corner.y) ** 2
      );
      if (distance <= this.#cornerRadius) {
        return i;
      }
    }
    return -1;
  }

  #handleTouchStart(event: TouchEvent) {
    const rect = this.#canvas.getBoundingClientRect();
    const touchX = event.touches[0].clientX - rect.left;
    const touchY = event.touches[0].clientY - rect.top;
    this.#afterTouchStart(touchX, touchY);
  }

  #handleMouseDown(event: MouseEvent) {
    const rect = this.#canvas.getBoundingClientRect();
    const touchX = event.clientX - rect.left;
    const touchY = event.clientY - rect.top;
    this.#afterTouchStart(touchX, touchY);
  }

  #afterTouchStart(touchX: number, touchY: number) {
    if (
      this.#isTouchInsideCropBox(touchX, touchY) === true &&
      this.#move.active === false
    ) {
      this.#move.active = true;
      this.#move.prevTouch.x = touchX;
      this.#move.prevTouch.y = touchY;
    } else {
      this.#selectedCornerIndex = this.#getSelectedCornerIndex(touchX, touchY);
    }
  }

  #isPointOnBorder(point: Position, borderPoints: Position[]) {
    for (let i = 0; i < borderPoints.length; i++) {
      const borderPoint1 = borderPoints[i];
      const borderPoint2 = borderPoints[(i + 1) % borderPoints.length];

      if (
        (point.y - borderPoint1.y) * (borderPoint2.x - borderPoint1.x) ===
          (borderPoint2.y - borderPoint1.y) * (point.x - borderPoint1.x) &&
        point.x >= Math.min(borderPoint1.x, borderPoint2.x) &&
        point.x <= Math.max(borderPoint1.x, borderPoint2.x) &&
        point.y >= Math.min(borderPoint1.y, borderPoint2.y) &&
        point.y <= Math.max(borderPoint1.y, borderPoint2.y)
      ) {
        return true;
      }
    }
    return false;
  }

  #moveCropBox(touchX: number, touchY: number) {
    const dx = touchX - this.#move.prevTouch.x;
    const dy = touchY - this.#move.prevTouch.y;

    let translatedCorners = [];
    for (let i = 0; i < this.#corners.length; i++) {
      const x = this.#corners[i].x + dx;
      const y = this.#corners[i].y + dy;

      translatedCorners[i] = {
        x: Math.max(
          this.#cornerRadius,
          Math.min(x, this.#overlayCanvas.width - this.#cornerRadius)
        ),
        y: Math.max(
          this.#cornerRadius,
          Math.min(y, this.#overlayCanvas.height - this.#cornerRadius)
        ),
      };
    }

    let movable = true;

    for (let i = 0; i < translatedCorners.length; i++) {
      if (
        this.#isPointOnBorder(translatedCorners[i], this.#canvasBorderPoints)
      ) {
        movable = false;
        break;
      }
    }

    if (movable) {
      this.#corners = translatedCorners;
    }

    this.#move.prevTouch.x = touchX;
    this.#move.prevTouch.y = touchY;
    this.#drawCropBox();
  }

  #cropBoxIsTooSmall(corners: Position[]) {
    return (
      corners[1].x - corners[0].x < this.#minCropBoxWidth ||
      corners[2].x - corners[3].x < this.#minCropBoxWidth ||
      corners[3].y - corners[0].y < this.#minCropBoxHeight ||
      corners[2].y - corners[1].y < this.#minCropBoxHeight
    );
  }

  #handleTouchMove(event: TouchEvent) {
    event.preventDefault();
    const rect = this.#canvas.getBoundingClientRect();
    let touchX = event.touches[0].clientX - rect.left;
    let touchY = event.touches[0].clientY - rect.top;
    this.#afterTouchMove(touchX, touchY);
  }

  #handleMouseMove(event: MouseEvent) {
    const rect = this.#canvas.getBoundingClientRect();
    let touchX = event.clientX - rect.left;
    let touchY = event.clientY - rect.top;
    this.#afterTouchMove(touchX, touchY);
  }

  #afterTouchMove(touchX: number, touchY: number) {
    if (this.#move.active === true) {
      this.#moveCropBox(touchX, touchY);
      return;
    }

    if (this.#selectedCornerIndex !== -1) {
      const points = [];
      for (let i = 0; i < this.#corners.length; i++) {
        if (i === this.#selectedCornerIndex) {
          points.push({ x: touchX, y: touchY });
        } else {
          points.push(this.#corners[i]);
        }
      }

      if (this.#cropBoxIsTooSmall(points)) {
        return;
      }

      this.#corners[this.#selectedCornerIndex].x = Math.max(
        this.#cornerRadius,
        Math.min(touchX, this.#overlayCanvas.width - this.#cornerRadius)
      );
      this.#corners[this.#selectedCornerIndex].y = Math.max(
        this.#cornerRadius,
        Math.min(touchY, this.#overlayCanvas.height - this.#cornerRadius)
      );

      this.#drawCropBox();
    }
  }

  #handleTouchEnd() {
    this.#move.active = false;
    this.#selectedCornerIndex = -1;
  }

  #applyPerspectiveTransform(points: Position[]) {
    let src: Mat = new cv.Mat(
      this.#canvas.height,
      this.#canvas.width,
      cv.CV_8UC4
    );
    src.data.set(
      this.#ctx.getImageData(0, 0, this.#canvas.width, this.#canvas.height).data
    );
    let dst = new cv.Mat();

    let dsize = new cv.Size(
      Math.max(
        Math.sqrt(
          (points[0].x - points[1].x) ** 2 + (points[0].y - points[1].y) ** 2
        ),
        Math.sqrt(
          (points[2].x - points[3].x) ** 2 + (points[2].y - points[3].y) ** 2
        )
      ) * window.devicePixelRatio,
      Math.max(
        Math.sqrt(
          (points[1].x - points[2].x) ** 2 + (points[1].y - points[2].y) ** 2
        ),
        Math.sqrt(
          (points[3].x - points[0].x) ** 2 + (points[3].y - points[0].y) ** 2
        )
      ) * window.devicePixelRatio
    );

    let srcTri = cv.matFromArray(
      4,
      1,
      cv.CV_32FC2,
      points.flatMap((point: Position) => [
        ((point.x - this.#cornerRadius) /
          (this.#canvas.width / window.devicePixelRatio)) *
          this.#canvas.width,
        ((point.y - this.#cornerRadius) /
          (this.#canvas.height / window.devicePixelRatio)) *
          this.#canvas.height,
      ])
    );

    let dstTri = cv.matFromArray(4, 1, cv.CV_32FC2, [
      0,
      0,
      dsize.width,
      0,
      dsize.width,
      dsize.height,
      0,
      dsize.height,
    ]);

    let M = cv.getPerspectiveTransform(srcTri, dstTri);
    cv.warpPerspective(
      src,
      dst,
      M,
      dsize,
      cv.INTER_LINEAR,
      cv.BORDER_CONSTANT,
      new cv.Scalar()
    );

    let tempCanvas = document.createElement("canvas");
    tempCanvas.width = dst.cols * window.devicePixelRatio;
    tempCanvas.height = dst.rows * window.devicePixelRatio;
    cv.imshow(tempCanvas, dst);

    src.delete();
    dst.delete();
    M.delete();
    return tempCanvas;
  }

  // Public methods

  loadImg(imgSrc: string): void {
    this.#img.src = imgSrc;
    this.#img.crossOrigin = "anonymous";
    this.#img.onload = () => {
      this.#initializeCanvasDimensions();
      this.#initializeCorners(this.#initialCorners);
      this.#drawImage();
      this.#drawCropBox();
    };
    this.#img.onerror = (error) => {
      throw new Error("Error loading image.");
    };
  }

  crop(): string {
    const croppedCanvas = this.#applyPerspectiveTransform(this.#corners);
    return croppedCanvas.toDataURL("image/png");
  }

  getBlob(): Promise<Blob> {
    return new Promise<Blob>((resolve, reject) => {
      const croppedCanvas = this.#applyPerspectiveTransform(this.#corners);
      croppedCanvas.toBlob((blob) => {
        if (blob) resolve(blob);
        else reject("Error getting blob.");
      });
    });
  }

  getFile(): Promise<File> {
    return new Promise<File>((resolve, reject) => {
      const croppedCanvas = this.#applyPerspectiveTransform(this.#corners);
      croppedCanvas.toBlob((blob) => {
        if (blob) {
          const file = new File([blob], "cropped-image.png");
          resolve(file);
        } else reject("Error getting file.");
      });
    });
  }

  getCanvas(): HTMLCanvasElement {
    return this.#canvas;
  }

  destroy(): void {
    this.#overlayCanvas.removeEventListener(
      "touchstart",
      this.#handleTouchStart
    );
    this.#overlayCanvas.removeEventListener("touchmove", this.#handleTouchMove);
    this.#overlayCanvas.removeEventListener("touchend", this.#handleTouchEnd);
    this.#overlayCanvas.removeEventListener("mousedown", this.#handleMouseDown);
    this.#overlayCanvas.removeEventListener("mousemove", this.#handleMouseMove);
    this.#overlayCanvas.removeEventListener("mouseup", this.#handleTouchEnd);
    this.#parent.removeChild(this.#relativePostionedDiv);
  }
}

export default Scanner;
