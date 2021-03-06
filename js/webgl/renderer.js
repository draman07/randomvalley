
function Renderer(canvasId){

	var canvas = document.getElementById(canvasId);
	var gl = canvas.getContext("webgl") || canvas.getContext("experimental-webgl");

	var float_texture_ext = gl.getExtension("OES_texture_float");
	var float_texture_linear_ext = gl.getExtension("OES_texture_float_linear");


	var width = Math.max(document.documentElement.clientWidth, window.innerWidth || 0);
	var height = Math.max(document.documentElement.clientHeight, window.innerHeight || 0);

	var scale = 1/3;
	
	canvas.width = width*scale;
	canvas.height = height*scale;
	
	var size;

	var lastHeight = canvas.height;
	var lastWidth = canvas.width;

	var layers = [];


	/*=========================Shaders========================*/


	var vertShader = gl.createShader(gl.VERTEX_SHADER);
	gl.shaderSource(vertShader, vertexShader);
	gl.compileShader(vertShader);

	var fragShader = gl.createShader(gl.FRAGMENT_SHADER);
	gl.shaderSource(fragShader, fragmentShader);
	gl.compileShader(fragShader);

	var terrShader = gl.createShader(gl.FRAGMENT_SHADER);
	gl.shaderSource(terrShader, terrainShader);
	gl.compileShader(terrShader);

	var shaderProgram = gl.createProgram();
	gl.attachShader(shaderProgram, vertShader); 
	gl.attachShader(shaderProgram, fragShader);
	gl.linkProgram(shaderProgram);

	var terrainProgram = gl.createProgram();
	gl.attachShader(terrainProgram, vertShader); 
	gl.attachShader(terrainProgram, terrShader);
	gl.linkProgram(terrainProgram);

	var starShader = gl.createShader(gl.FRAGMENT_SHADER);
	gl.shaderSource(starShader, starShaderText);
	gl.compileShader(starShader);

	var starProgram = gl.createProgram();
	gl.attachShader(starProgram, vertShader); 
	gl.attachShader(starProgram, starShader);
	gl.linkProgram(starProgram);

	var hasErrors = false;
	
	if(gl.getShaderInfoLog(vertShader)){
		console.log("Error in vertShader:");
		console.error(gl.getShaderInfoLog(vertShader));
		hasErrors = true;
	}
	if(gl.getShaderInfoLog(fragShader)){
		console.log("Error in fragShader:");
		console.error(gl.getShaderInfoLog(fragShader));
		hasErrors = true;
	}
	if(gl.getProgramInfoLog(shaderProgram)){
		console.log("Error in shaderProgram:");
		console.error(gl.getProgramInfoLog(shaderProgram));
		hasErrors = true;
	}
	if(gl.getShaderInfoLog(terrShader)){
		console.log("Error in terrShader:");
		console.error(gl.getShaderInfoLog(terrShader));
		hasErrors = true;
	}
	if(gl.getProgramInfoLog(terrainProgram)){
		console.log("Error in terrainProgram:");
		console.error(gl.getProgramInfoLog(terrainProgram));
		hasErrors = true;
	}
	if(gl.getShaderInfoLog(starShader)){
		console.log("Error in starShader:");
		console.error(gl.getShaderInfoLog(starShader));
		hasErrors = true;
	}
	if(gl.getProgramInfoLog(starProgram)){
		console.log("Error in starProgram:");
		console.error(gl.getProgramInfoLog(starProgram));
		hasErrors = true;
	}

	if(hasErrors){
		console.error("Shaders contain errors. Aborting.");
		return false;
	}


	vertexBuffer = gl.createBuffer();

	/*==========Defining and storing the geometry=======*/

	var vertices = [
		-1.0, -1.0,
		 1.0, -1.0,
		-1.0,  1.0,
		-1.0,  1.0,
		 1.0, -1.0,
		 1.0,  1.0
	];

	size = ~~(vertices.length/2);
	
	gl.bindBuffer(gl.ARRAY_BUFFER, vertexBuffer);
	gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(vertices), gl.STATIC_DRAW);
	gl.bindBuffer(gl.ARRAY_BUFFER, null);

	gl.bindBuffer(gl.ARRAY_BUFFER, vertexBuffer);

	// Get the attribute location
	var coord = gl.getAttribLocation(shaderProgram, "coordinates");

	// Point an attribute to the currently bound VBO
	gl.vertexAttribPointer(coord, 2, gl.FLOAT, false, 0, 0);

	// Enable the attribute
	gl.enableVertexAttribArray(coord);
	

	function addLayer(image, parallax, type, settings){
		
		var texture = gl.createTexture();
		gl.bindTexture(gl.TEXTURE_2D, texture);
		gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image);

		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

		if(type == "terrain"){
			var heightmap = gl.createTexture();
			gl.bindTexture(gl.TEXTURE_2D, heightmap);
			gl.texImage2D(
				gl.TEXTURE_2D,
				0,
				gl.RGB,
				image.width,
				image.height,
				0,
				gl.RGB,
				gl.FLOAT,
				settings.heightmap
			);
			gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
			gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
			gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
			gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

			settings.heightmap = heightmap;
		}
		
		layers.push({
			 texture: texture
			,width: image.width
			,height: image.height
			,parallax: parallax*parallax*parallax*parallax
			,type: type
			,settings: settings
		});
	}

	var offsetX = 0;
	var rainOffset = [0, 0];
	var lastTime = Date.now();
	var cloudOffset = 0;
	var settings = {};
	var sunPosition = [0, 0];

	var sunLightColors = [
		[0 , 0.07, 0.07, 0.07],
		[3 , 0.15, 0.1 , 0.15],
		[6 , 0.7 , 0.5 , 0.2 ],
		[9 , 0.9 , 0.9 , 0.8 ],
		[12, 0.9 , 0.9 , 0.9 ],
		[15, 0.8 , 0.8 , 0.9 ],
		[18, 1.0 , 0.8 , 0.6 ],
		[19.5, 1.0 , 0.6 , 0.3 ],
		[21, 0.4 , 0.3 , 0.2 ],
		[24, 0.07, 0.07, 0.07],
	];

	/*var sunLightColors = [
		[0 , 0.07, 0.07, 0.07],
		[24, 0.07, 0.07, 0.07],
	];*/

	var ambientLightColors = [
		[0 , 0.1 , 0.2 , 0.25],
		[6 , 0.3 , 0.2 , 0.1 ],
		[12, 0.3 , 0.4 , 0.5 ],
		[18, 0.3 , 0.2 , 0.1 ],
		[24, 0.1 , 0.2 , 0.25],
	];

	var ambientLightColors = [
		[0 , 0.1   , 0.1 , 0.2 ],
		[24, 0.1   , 0.1 , 0.2 ],
	];

	function getColorByTime(time, colors){
		for(var i = 0; i < colors.length; i++){
			if(!colors[i+1]){
				return [colors[i][1], colors[i][2], colors[i][3]];
			} else if(time <= colors[i+1][0]){
				var span = colors[i+1][0]-colors[i][0];
				var relative = (time - colors[i][0])/span;
				return([
					colors[i][1]*(1-relative) + colors[i+1][1]*(relative),
					colors[i][2]*(1-relative) + colors[i+1][2]*(relative),
					colors[i][3]*(1-relative) + colors[i+1][3]*(relative)
				]);
			}
		}
	}

	function render(){

		var now = Date.now();
		var diff = now - lastTime;
		lastTime = now;
		
		var nanoTime = window.performance.now()/4000;
		sunPosition = [Math.sin(nanoTime), Math.cos(nanoTime)];
		
		var time = ((nanoTime)/(Math.PI*2))%1;
		time = time * 24;

		var sunLight = getColorByTime(time, sunLightColors);
		//console.log(time, sunLight);
		//var sunLight = [1, 1, 1];
		var ambientLight = getColorByTime(time, ambientLightColors);
		
		//var hour = (time - time%1) + "";
		//var minute = Math.floor((time%1)*60) + "";
		//console.log(("0"+hour).slice(-2) + ":" + ("0"+minute).slice(-2));
		
		rainOffset[0] -= (diff/(2))*settings.windSpeed;
		rainOffset[1] -= diff/(2);
		cloudOffset -= (diff/100)*settings.windSpeed;
		offsetX += diff/30;

		
		var activeProgram;

		gl.viewport(0, 0, canvas.width, canvas.height);

		for(var i = 0; i < layers.length; i++){

			if(layers[i].type == "terrain"){
				gl.useProgram(terrainProgram);
				activeProgram = terrainProgram;

				var u_image0Location = gl.getUniformLocation(activeProgram, "u_image0");
				var u_image1Location = gl.getUniformLocation(activeProgram, "u_image1");
				gl.uniform1i(u_image0Location, 0);
				gl.uniform1i(u_image1Location, 1);

				gl.activeTexture(gl.TEXTURE0);
				gl.bindTexture(gl.TEXTURE_2D, layers[i].texture);
				gl.activeTexture(gl.TEXTURE1);
				gl.bindTexture(gl.TEXTURE_2D, layers[i].settings.heightmap);

				var scaleAttr = gl.getUniformLocation(activeProgram, "scale");
				gl.uniform1f(scaleAttr, layers[i].settings.scale);

				var hillshadeIntensityAttr = gl.getUniformLocation(activeProgram, "hillshadeIntensity");
				gl.uniform1f(hillshadeIntensityAttr, layers[i].settings.hillshadeIntensity);
				
			} else if(layers[i].type == "stars"){

				gl.useProgram(starProgram);
				activeProgram = starProgram;

				gl.activeTexture(gl.TEXTURE0);
				gl.bindTexture(gl.TEXTURE_2D, layers[i].texture);
				
			} else {
				gl.useProgram(shaderProgram);
				activeProgram = shaderProgram;

				gl.activeTexture(gl.TEXTURE0);
				gl.bindTexture(gl.TEXTURE_2D, layers[i].texture);
			}

			var onePixelAttr = gl.getUniformLocation(activeProgram, "onePixel");
			gl.uniform2f(onePixelAttr, 1/lastWidth, 1/lastHeight);

			var textureSizeAttr = gl.getUniformLocation(activeProgram, "textureSize");
			gl.uniform2f(textureSizeAttr, layers[i].width, layers[i].height);

			var viewportSizeAttr = gl.getUniformLocation(activeProgram, "viewportSize");
			gl.uniform2f(viewportSizeAttr, canvas.width, canvas.height);
			
			var parallaxAttr = gl.getUniformLocation(activeProgram, "parallax");
			gl.uniform1f(parallaxAttr, layers[i].parallax);

			var sunPositionAttr = gl.getUniformLocation(activeProgram, "sunPosition");
			gl.uniform2f(sunPositionAttr, sunPosition[0], sunPosition[1]);

			var ambientLightAttr = gl.getUniformLocation(activeProgram, "ambientLight");
			gl.uniform3f(ambientLightAttr,
				ambientLight[0],
				ambientLight[1],
				ambientLight[2]
			);

			var sunLightAttr = gl.getUniformLocation(activeProgram, "sunLight");
			gl.uniform3f(sunLightAttr,
				sunLight[0],
				sunLight[1],
				sunLight[2]
			);

			var offsetAttr = gl.getUniformLocation(activeProgram, "offset");
			if(layers[i].type == "rain"){
				gl.uniform2f(
					offsetAttr,
					rainOffset[0]*layers[i].settings.rainSpeed + offsetX,
					rainOffset[1]*layers[i].settings.rainSpeed
				);
			} else if(layers[i].type == "cloud"){
				gl.uniform2f(offsetAttr, offsetX+cloudOffset, 0);
			} else {
				gl.uniform2f(offsetAttr, offsetX, 0);
			}

			var preserveAlphaAttr = gl.getUniformLocation(activeProgram, "preserveAlpha");
			if(layers[i].type == "haze" || layers[i].type == "rain"){
				gl.uniform1i(preserveAlphaAttr, true);
			} else {
				gl.uniform1i(preserveAlphaAttr, false);
			}


			gl.bindBuffer(gl.ARRAY_BUFFER, vertexBuffer);
			
			gl.enableVertexAttribArray(coord);
			gl.vertexAttribPointer(coord, 2, gl.FLOAT, false, 0, 0);

			gl.disable(gl.DEPTH_TEST);
			gl.enable(gl.BLEND);
			gl.blendFunc( gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA );

			gl.drawArrays(gl.TRIANGLES, 0, size);

		}

		window.requestAnimationFrame(render);
		
	}

	function setSettings(newSettings){
		settings = newSettings;
	}

	return{
		 render: render
		,addLayer: addLayer
		,setSettings: setSettings
	};

}



















