## Introduction

Package **document_crop** is a JavaScript library which you can use to create CamScanner-like cropping functionality for web applications. Make use of this declarative, unopinionated, and framework-agnostic library to effortlessly integrate advanced document scanning and cropping features into your web projects.

### Key Features:

- **Declarative Approach**: Easily define and manipulate document cropping behavior using a declarative syntax.

- **Unopinionated Design**: Tons of flexibility and customization options.

- **Framework-Agnostic**: Seamlessly integrate with your preferred web framework.
  <br>

## Basic Example Usage

```javascript
import Scanner from "document_crop";

const scanner = new Scanner({
  parent: document.getElementById("parent-div"), //must be a HTMLDivElement
  width: 400,
});

scanner.loadImg("path/to/image.jpg");

const croppedImage = await scanner.crop({ format: "base64" });
```

## Vanilla JS Usage

_index.html_

```html5
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Document Crop Usage</title>
    <script src="./index.js" defer></script>
  </head>
  <body>
    <input
      id="image_input"
      type="file"
      accept="
    image/png,image/jpg,image/jpeg,image/gif
    " />
    <button id="upload_button">Upload</button>
    <button id="crop_button">Crop</button>
    <div id="container"></div>
  </body>
</html>
```

_index.js_

```javascript
import Scanner from "document_crop";

const parentDiv = document.getElementById("container");
const imgInput = document.getElementById("image_input");
const uploadBtn = document.getElementById("upload_button");
const cropBtn = document.getElementById("crop_button");

let scanner = new Scanner({
  parent: parentDiv,
  width: 300,
});

uploadBtn.addEventListener("click", () => {
  if (imgInput.files && imgInput.files[0]) {
    const file = imgInput.files[0];
    const reader = new FileReader();
    reader.onload = function (e) {
      console.log(e.target.result);
      scanner.loadImg(e.target.result);
    };
    reader.readAsDataURL(file);
  }
});

cropBtn.addEventListener("click", () => {
  scanner.crop({ format: "file" }).then((file) => {
    const img = document.createElement("img");
    img.src = URL.createObjectURL(file);
    img.width = 200;
    document.body.appendChild(img);
  });
});
```

## ReactJs Usage

```
import React, { useState, useRef } from 'react';
import Scanner from 'document_crop';

const Editor = (props) => {
  const [imgSrc, setImgSrc] = useState("https://picsum.photos/300/600");
  const [scanner, setScanner] = useState(null);
  const divRef = useRef(null);

  useEffect(() => {
    const scan = new Scanner({
      parent: divRef.current,
      width: 300,
      maxHeight: 550,
      cornerRadius: 14,
      cornerColor: "black",
      cropBoxBorderColor: "white" ,
      backdropColor: "rgba(40,40,40,0.5)",
      initialCorners: [
        { x: 15, y: 15 },
        { x: 85, y: 15 },
        { x: 85, y: 85 },
        { x: 15, y: 85 },
      ],
    });
    scan.loadImg(imgSrc);
    setScanner(scan);
    return () => {
      scan.destroy();
      setScanner(null);
    };
  }, [imgSrc]);

  const returnCroppedImage = () => {
    if (scanner) {
      const src = scanner.crop({ format: "base64" });
      return src;
    }
  };

  return (
    <>
      <img src={imgSrc} />
      <div ref={divRef}></div>
      <button onClick={() => setImgSrc("https://picsum.photos/400/600")}>
        Change Image
      </button>
      <button onClick={() => console.log(returnCroppedImage())}>
        Crop
      </button>
    </>
  );
}
```

## What This Library Is

The `document_crop` library is meant for bulding web applications that need to scan documents. Traditional image cropping libraries for the web limit you to rectangular shapes, which might not be sufficent for this usage.

#### With document_crop, you can:

- Crop any quadrilateral shape area on the image, which is what document scanning needs.
- Perform perspective wrapping to produce rectangular image output.

## What This Library Isn't

- This library does not apply filters to images to simulate a "document" look automatically.
- This is not an edge detection library.

However,

- The library offers interfaces for implementing these such as applying filters or detecting edges in the document.
- It remains non-opinionated about the usage of external services, allowing you to choose and integrate services of your preference for these functionalities.

See [Advanced Usage](#advanced-usage) section for more.

## Constructor and Its Parameters

### Note: All measurements are in pixels.

### `Scanner(options)`

| Option               | Type                        | Required | Description                                            | Default                  |
| -------------------- | --------------------------- | -------- | ------------------------------------------------------ | ------------------------ |
| `parent`             | HTMLDivElement              | Yes      | The HTMLDivElement where the scanner will be appended. | -                        |
| `width`              | number                      | No       | The width of the scanner canvas.                       | -                        |
| `height`             | number                      | No       | The height of the scanner canvas.                      | -                        |
| `maxWidth`           | number                      | No       | The maximum width of the scanner canvas.               | -                        |
| `maxHeight`          | number                      | No       | The maximum height of the scanner canvas.              | -                        |
| `cornerRadius`       | number                      | No       | The corner radius for the crop box.                    | `12`                     |
| `cornerColor`        | string                      | No       | The color of the corner points.                        | `"lightgreen"`           |
| `cropBoxColor`       | string                      | No       | The color of the crop box.                             | -                        |
| `backdropColor`      | string                      | No       | The color of the backdrop outside the crop box.        | `"rgba(0, 0, 0, 0.5)"`   |
| `minCropBoxWidth`    | number                      | No       | The minimum width of the crop box.                     | `100`                    |
| `minCropBoxHeight`   | number                      | No       | The minimum height of the crop box.                    | `100`                    |
| `cropBoxBorderWidth` | number                      | No       | The border width of the crop box.                      | `1`                      |
| `cropBoxBorderColor` | string                      | No       | The border color of the crop box.                      | `"rgba(255, 255, 255)"`  |
| `initialCorners`     | [{x: number, y: number}][4] | No       | Initial corners for the crop box. See details below.   | Covers the whole canvas. |

### Caveats:

- **Setting dimensions**: If only one of 'width' or 'height' is set, the other dimension i.e, 'height' and 'width' respectively, will be set preserving the original image's aspect ratio. If none is set, the canvas will take the image's natural width and height.
- **initialCorners**: Expects an array of four objects, each having x and y properties as percentage of the canvas size. These objects represent position of the cropbox corners in clockwise order, starting from the top-left corner.
  <br>

For example, the following 'initalCorners' will create a centered rectangular cropbox.

```
...
initialCorners: [
{ x: 25, y: 25 }, // top-left
{ x: 75, y: 25 }, // top-right
{ x: 75, y: 75 }, // bottom-right
{ x: 25, y: 75 }  // bottom-left
]
...
```

## Methods

### `loadImg(imgSrc)`

Loads an image into the scanner.

- `imgSrc` (string): The source URL of the image. Equivalent to 'src' attribute in HTMLImageElement.

### `crop(options)`

Crops the image within the defined crop box and returns the result.

- `options` (object): Optional. An options object.
  - `format` (string): Optional. The format of the result. Possible values:
    - 'base64': returns **String** representing base64 encoded image **(default)**
    - 'blob': returns **Promise** resolving into the Blob object.
    - 'file': returns **Promise** resolving into the File object.

### `destroy()`

Destroys the scanner instance and removes its elements from the DOM. Call this method before creating another instance to prevent memory leaks.

## Advanced Usage

The library has been written considering the advanced use cases where app might need features such as document edge detection, or filters. <br>

**Edge detection**:
The library is unopinionated about what external library you use for edge detection. The API provides `initialCorners` option to which you can input the output of the edge detection library. Make sure to map the output to the format of the initalCorners option.

**Filters**: The library is unopinionated about what external library you use for filters. Just input the output of the filter library to the `loadImg` method.
