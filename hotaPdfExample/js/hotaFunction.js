async function hotaGetOutline(){
	const numFontSizeGet = 4;
	
	const outline = await PDFViewerApplication.pdfDocument.getOutline();
	if(outline){
		let format_list = [];
		function format_item(items){
			if(!items) return [];
			let arr = [];
			for(let i = 0; i<items.length; i++){
				arr.push({
					"dest": items[i].dest,
					"text": items[i].title,
					"childs": format_item(items[i].items),
				});
			}		
			return arr;
		}
		return format_item(outline);
	} else {
		let s = [];
		let listKey = [];
		let pageMap = PDFViewerApplication.pdfDocument;
		let listRawPageContent = [];
		
		for(let i = 0; i<pageMap.numPages; i++){
			let contentInPage = (await (await pageMap.getPage(i+1)).getTextContent()).items;
			listRawPageContent.push(contentInPage);
		}
		
		for(let i = 0; i<listRawPageContent.length; i++){
			let contentInPage = listRawPageContent[i];
			let previousEOL = false;
			for(let j = 0; j<contentInPage.length; j++){
				let key = contentInPage[j].height;
				let content = contentInPage[j].str;
				let hasEOL = contentInPage[j].hasEOL;
				// Fitter by length
				let content_temp = content.replace(/[\n\r]/, "");
				if(content_temp.length < 6) continue;
				
				if(!s[key]){
					s[key] = 0;
					let font_size = Math.round(key * 10).toString();
					listKey.push(font_size);
				}
				s[key] += 1;
			}
		}
		listKey = listKey.sort((x, y) => y-x).slice(0, Math.min(numFontSizeGet, listKey.length));

		let listContent = [];
		let previousEOL = false;
		for(let i = 0; i<listRawPageContent.length; i++){
			let contentInPage = listRawPageContent[i];
			for(let j = 0; j<contentInPage.length; j++){
				let key = contentInPage[j].height;
				let font_size = Math.round(key * 10).toString();
				let rank_font_size = listKey.indexOf(font_size);
				if (rank_font_size < 0) continue;
				let content = contentInPage[j].str;
				let hasEOL = contentInPage[j].hasEOL;
				// Fitter by length
				let content_temp = content.replace(/[\n\r]/, "");
				if(content_temp.length < 6 || content_temp.length > 100) continue;

				// Add to listContent
				if (previousEOL){
					listContent[listContent.length - 1].text += ` ${content}`;
				} else {
					let space = "";
					for(let k = 0; k<rank_font_size; k++) space += " ";
					listContent.push({
						"info": `${space}[${rank_font_size+1}; ${i+1}] `,
						"text": `${content}`
					});
				}
				previousEOL = hasEOL;
			}
		}
		// Filter and covert to rawContent
		let rawContent = "";
		for(let i = 0; i<listContent.length; i++){
			if(listContent[i].text.length > 100) continue;
			rawContent += `${listContent[i].info}${listContent[i].text}\n`;
		}
		// console.log(rawContent);
		
		// oehTUcJfOD
		// https://pdf-api.xpath.asia/api-server/v2.0/pdf/outline
		/*
		{
		  "raw_content": "string"
		}
		*/
		let res = await fetch("https://pdf-api.xpath.asia/api-server/v2.0/pdf/outline", {
			headers: {
			"Content-Type": "application/json",
			"api-key": "oehTUcJfOD",
			},
			method: "POST",
			body: JSON.stringify({
				"raw_content": rawContent
			}),
		});
		if (!res.ok) {
		  throw new Error(`Response status: ${response.status}`);
		}
		let resJson = await res.json();
		// console.log(resJson);
		if (resJson.success != "success"){
			throw new Error(`Response status: ${resJson.success}, Message: ${resJson.message}`);
		}
		
		return resJson.data;
	}
}