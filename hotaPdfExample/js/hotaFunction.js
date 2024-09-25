// Support Function
async function _hotaGetListContent(pdfDocument) {
  // Load content page to cache
  let listRawPageContent = [];
  for (let i = 0; i < pdfDocument.numPages; i++) {
    let contentInPage = (
      await (await pdfDocument.getPage(i + 1)).getTextContent()
    ).items;
    listRawPageContent.push(contentInPage);
  }
  // Load textbox
  let listContent = [];
  let previousEOL = false;
  let previousHeight = -10;
  let previousY_Bottom = -10;
  let previousY_Top = -10;
  for (let i = 0; i < listRawPageContent.length; i++) {
    const contentInPage = listRawPageContent[i];
    for (let j = 0; j < contentInPage.length; j++) {
      const content = contentInPage[j].str;
      const hasEOL = contentInPage[j].hasEOL;
      const height = contentInPage[j].height;
      const x = contentInPage[j].transform[4];
      const yPosB = contentInPage[j].transform[5];
      const yPosT = yPosB + height;

      // Add to listContent
      if (previousEOL) {
        if (Math.abs(yPosT - previousY_Bottom) <= 5.0) {
          listContent[listContent.length - 1].text += ` ${content}`;
        } else {
          listContent.push({
            page: i + 1,
            height: height,
            text: `${content}`,
            x: x,
            y: yPosB,
          });
        }
      } else {
        // Check if text in same line
        if (
          Math.abs(yPosB - previousY_Bottom) <= 1.0 ||
          Math.abs(yPosT - previousY_Top) <= 1.0
        ) {
          listContent[listContent.length - 1].text += `${content}`;
        } else {
          listContent.push({
            page: i + 1,
            height: height,
            text: `${content}`,
            x: x,
            y: yPosB,
          });
        }
      }
      previousY_Bottom = yPosB;
      previousY_Top = yPosT;
      previousHeight = height;
      previousEOL = hasEOL;
    }
  }

  return listContent;
}

function _hotaBuildDepthOutline(outline) {
  let mapIndexDepth = {};
  let listIndexDepth = [];

  function buildDepth(depth, ele, refIndexDepth, listIndexDepth) {
    if (!refIndexDepth[ele.index.toString()]) {
      refIndexDepth[ele.index.toString()] = depth;
      listIndexDepth.push({
        key: ele.index,
        value: depth,
      });
    }
    if (ele.childs) {
      for (let i = 0; i < ele.childs.length; i++) {
        buildDepth(depth + 1, ele.childs[i], refIndexDepth, listIndexDepth);
      }
    }
  }

  for (let i = 0; i < outline.length; i++) {
    buildDepth(0, outline[i], mapIndexDepth, listIndexDepth);
  }
  // Sort
  listIndexDepth = listIndexDepth.sort((x, y) => x.key - y.key);
  return {
    map: mapIndexDepth,
    list: listIndexDepth,
  };
}

// Add function to PDFViewerApplication
function hotaLibAdd(
  _globalThis,
  _PDFViewerApplication,
  _PDFViewerApplicationOptions
) {
  // const alice
  const {
    AbortException,
    AnnotationEditorLayer,
    AnnotationEditorParamsType,
    AnnotationEditorType,
    AnnotationEditorUIManager,
    AnnotationLayer,
    AnnotationMode,
    build,
    CMapCompressionType,
    ColorPicker,
    createValidAbsoluteUrl,
    DOMSVGFactory,
    DrawLayer,
    FeatureTest,
    fetchData,
    getDocument,
    getFilenameFromUrl,
    getPdfFilenameFromUrl: pdfjs_getPdfFilenameFromUrl,
    getXfaPageViewport,
    GlobalWorkerOptions,
    ImageKind,
    InvalidPDFException,
    isDataScheme,
    isPdfFile,
    MissingPDFException,
    noContextMenu,
    normalizeUnicode,
    OPS,
    PasswordResponses,
    PDFDataRangeTransport,
    PDFDateString,
    PDFWorker,
    PermissionFlag,
    PixelsPerInch,
    RenderingCancelledException,
    setLayerDimensions,
    shadow,
    TextLayer,
    UnexpectedResponseException,
    Util,
    VerbosityLevel,
    version,
    XfaLayer,
  } = _globalThis.pdfjsLib;
  const OptionKind = {
    BROWSER: 0x01,
    VIEWER: 0x02,
    API: 0x04,
    WORKER: 0x08,
    EVENT_DISPATCH: 0x10,
    PREFERENCE: 0x80,
  };
  const AppOptions = _PDFViewerApplicationOptions;

  // Function load
  _PDFViewerApplication.hota_open_document = async function (args) {
    const workerParams = AppOptions.getAll(OptionKind.WORKER);
    Object.assign(GlobalWorkerOptions, workerParams);

    const apiParams = AppOptions.getAll(OptionKind.API);
    const loadingTask = getDocument({
      ...apiParams,
      ...args,
    });

    return loadingTask.promise.then(
      (pdfDocument) => {
        return pdfDocument;
      },
      (reason) => {
        let key = "pdfjs-loading-error";
        if (reason instanceof InvalidPDFException) {
          key = "pdfjs-invalid-file-error";
        } else if (reason instanceof MissingPDFException) {
          key = "pdfjs-missing-file-error";
        } else if (reason instanceof UnexpectedResponseException) {
          key = "pdfjs-unexpected-response-error";
        }
        return this._documentError(key, {
          message: reason.message,
        }).then(() => {
          throw reason;
        });
      }
    );
  };
  _PDFViewerApplication.hotaLoad = async function (file) {
    const { appConfig, eventBus } = this;
    // validateFileURL(file);
    const fileInput = (this._openFileInput = document.createElement("input"));
    fileInput.id = "fileInput";
    fileInput.hidden = true;
    fileInput.type = "file";
    fileInput.value = null;
    document.body.append(fileInput);
    fileInput.addEventListener("change", function (evt) {
      const { files } = evt.target;
      if (!files || files.length === 0) {
        return;
      }
      eventBus.dispatch("fileinputchange", {
        source: this,
        fileInput: evt.target,
      });
    });
    appConfig.mainContainer.addEventListener("dragover", function (evt) {
      for (const item of evt.dataTransfer.items) {
        if (item.type === "application/pdf") {
          evt.dataTransfer.dropEffect =
            evt.dataTransfer.effectAllowed === "copy" ? "copy" : "move";
          evt.preventDefault();
          evt.stopPropagation();
          return;
        }
      }
    });
    appConfig.mainContainer.addEventListener("drop", function (evt) {
      if (evt.dataTransfer.files?.[0].type !== "application/pdf") {
        return;
      }
      evt.preventDefault();
      evt.stopPropagation();
      eventBus.dispatch("fileinputchange", {
        source: this,
        fileInput: evt.dataTransfer,
      });
    });
    if (!AppOptions.get("supportsDocumentFonts")) {
      AppOptions.set("disableFontFace", true);
      this.l10n.get("pdfjs-web-fonts-disabled").then((msg) => {
        console.warn(msg);
      });
    }
    if (!this.supportsPrinting) {
      appConfig.toolbar?.print?.classList.add("hidden");
      appConfig.secondaryToolbar?.printButton.classList.add("hidden");
    }
    if (!this.supportsFullscreen) {
      appConfig.secondaryToolbar?.presentationModeButton.classList.add(
        "hidden"
      );
    }
    if (this.supportsIntegratedFind) {
      appConfig.findBar?.toggleButton?.classList.add("hidden");
    }
    if (file) {
      this.open({
        url: file,
      });
    } else {
      this._hideViewBookmark();
    }
  };
}

// Main function
async function hotaGetOutline(
  fileUrl,
  numFontSizeGet = 10,
  lengthMin = 5,
  lengthMax = 100,
  debug = false
) {
  // Load pdf document by url
  const pdfDocument = await PDFViewerApplication.hota_open_document({
    url: fileUrl,
  });

  // Get textbox
  const listContent = await _hotaGetListContent(pdfDocument);

  // Define global return
  let outlineRes = [];

  // Get outline
  const outline = await pdfDocument.getOutline();
  if (outline && !debug) {
    // If outline exits
    let format_list = [];
    // Function procress
    async function format_item(items, index_st = 0) {
      if (!items) return [];
      let arr = [];
      // Loop all outline raw content
      for (let i = 0; i < items.length; i++) {
        const destInfo = await pdfDocument.getDestination(items[i].dest);
        const [destRef] = destInfo;
        const indexPage = await pdfDocument.getPageIndex(destRef);

        // Get index element content
        let indexEle = -1;
        const xDest = destInfo[2],
          yDest = destInfo[3];
        for (let j = index_st; j < listContent.length; j++) {
          const xEle = listContent[j].x;
          const yEle = listContent[j].y;
          if (
            listContent[j].page == indexPage + 1 &&
            xDest <= xEle &&
            yDest >= yEle
          ) {
            indexEle = j;
            index_st = j + 1;
            break;
          }
        }

        // Add to array
        arr.push({
          index: indexEle,
          page: indexPage + 1,
          text: items[i].title,
          childs: await format_item(items[i].items, index_st),
        });
      }
      return arr;
    }

    // Set to res
    outlineRes = await format_item(outline);
  } else {
    let s = {};
    let listKey = [];
    let fpi = 1;

    // Load font size as key to list of uniqueID
    for (let i = 0; i < listContent.length; i++) {
      let font_size = Math.round(listContent[i].height * fpi);
      let key = font_size.toString();
      if (!s[key]) {
        s[key] = 0;
        listKey.push(font_size);
      }
      s[key] += 1;
    }
    // Sort font size from big to small
    listKey = listKey
      .sort((x, y) => y - x)
      .slice(0, Math.min(numFontSizeGet, listKey.length));

    // Load textbox
    const listContent_temp = [];
    for (let i = 0; i < listContent.length; i++) {
      const ele = listContent[i];
      const key = ele.height;
      const font_size = Math.round(key * fpi);
      const rank_font_size = listKey.indexOf(font_size);
      if (rank_font_size < 0) continue;

      const content = ele.text;
      const pageIndex = ele.page;

      let space = "";
      for (let k = 0; k < rank_font_size; k++) space += " ";
      listContent_temp.push({
        info: `[${rank_font_size + 1}; ${pageIndex}; ${i}] `,
        text: `${content}`,
      });
    }

    // Filter and covert to rawContent
    let rawContent = "";
    for (let i = 0; i < listContent_temp.length; i++) {
      if (
        listContent_temp[i].text.length > lengthMax ||
        listContent_temp[i].text.length < lengthMin
      )
        continue;
      rawContent += `${listContent_temp[i].info}${listContent_temp[i].text}\n`;
    }
    // console.log(rawContent);
    // return rawContent;
    // console.log(rawContent);

    // oehTUcJfOD
    // https://pdf-api.xpath.asia/api-server/v2.0/pdf/outline
    /*
		{
		  "raw_content": "string"
		}
		*/
    let res = await fetch(
      "https://pdf-api.xpath.asia/api-server/v2.0/pdf/outline",
      {
        headers: {
          "Content-Type": "application/json",
          "api-key": "oehTUcJfOD",
        },
        method: "POST",
        body: JSON.stringify({
          raw_content: rawContent,
        }),
      }
    );
    if (!res.ok) {
      throw new Error(`Response status: ${response.status}`);
    }
    let resJson = await res.json();
    // console.log(resJson);
    if (resJson.success != "success") {
      throw new Error(
        `Response status: ${resJson.success}, Message: ${resJson.message}`
      );
    }

    // Set to res
    outlineRes = resJson.data;
  }

  return {
    outline: outlineRes,
    textbox: listContent,
  };
}

async function hotaGetContentCurPdf() {
  // Load pdf document by url
  const pdfDocument = PDFViewerApplication.pdfDocument;

  // Load textbox
  const listContent = await _hotaGetListContent(pdfDocument);

  // Build content text
  let contentRawText = "";
  for (let i = 0; i < listContent.length; i++) {
    contentRawText += listContent[i].text + "\n";
  }

  return contentRawText;
}

function getSelectionTextAndContainerElement() {
  var text = "",
    containerElement = null;
  if (typeof window.getSelection != "undefined") {
    var sel = window.getSelection();
    if (sel.rangeCount) {
      var node = sel.getRangeAt(0).commonAncestorContainer;
      containerElement = node.nodeType == 1 ? node : node.parentNode;
      text = sel.toString();
    }
  } else if (
    typeof document.selection != "undefined" &&
    document.selection.type != "Control"
  ) {
    var textRange = document.selection.createRange();
    containerElement = textRange.parentElement();
    text = textRange.text;
  }
  if (!document.getElementById("viewerContainer").contains(containerElement)) {
    return {
      text: "",
      containerElement: null,
    };
  }
  return {
    text: text,
    containerElement: containerElement,
  };
}

function hotaGetContents(indexs, hData) {
  const resDepth = _hotaBuildDepthOutline(hData.outline);
  let resContents = [];
  for (let i = 0; i < indexs.length; i++) {
    const index = indexs[i];
    let t = resDepth.list.findIndex((ele) => ele.key == index);
    if (t < 0) {
      console.error("Can't find index: ", index);
      continue;
    }

    const indexTextbox = resDepth.list[t].key;
    const depth = resDepth.list[t].value;

    // Find end of index
    let indexEnd = hData.textbox.length;
    for (let j = t + 1; j < resDepth.list.length; j++) {
      const ele = resDepth.list[j];
      if (ele.value <= depth) {
        indexEnd = ele.key;
        break;
      }
    }

    // Get content
    let content_temp = "";
    for (let j = indexTextbox; j < indexEnd; j++) {
      content_temp += hData.textbox[j].text + "\n";
    }
    resContents.push(content_temp);
  }

  return resContents;
}
