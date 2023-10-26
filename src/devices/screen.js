'use strict'


function rgbhex(color) {
	return "#" + color.r.toString(16) + color.g.toString(16) + color.b.toString(16);
}

const blending = [
	[0, 0, 0, 0, 1, 0, 1, 1, 2, 2, 0, 2, 3, 3, 3, 0],
	[0, 1, 2, 3, 0, 1, 2, 3, 0, 1, 2, 3, 0, 1, 2, 3],
	[1, 2, 3, 1, 1, 2, 3, 1, 1, 2, 3, 1, 1, 2, 3, 1],
	[2, 3, 1, 2, 2, 3, 1, 2, 2, 3, 1, 2, 2, 3, 1, 2]];

function Screen(emu)
{
	this.colors = [];
	this.width, this.height = 1;

	this.init_screen = () => {
		this.bgImage = this.bgctx.createImageData(this.width, this.height);
		this.fgImage = this.fgctx.createImageData(this.width, this.height);
		this.bgPixels = new Uint8Array(this.width * this.height * 4);
		this.fgPixels = new Uint8Array(this.width * this.height * 4);
	}

	this.update_screen = () => {
		this.bgImage.data.set(this.bgPixels);
		this.fgImage.data.set(this.fgPixels);
		this.bgctx.putImageData(this.bgImage,0,0);
		this.fgctx.putImageData(this.fgImage,0,0);
		this.bgctx.drawImage(emu.fgCanvas,0,0);
	}

	// naive functions
	// assumes that you set height/width on startup (most roms do)
	this.set_width = (w) => {
		this.fgctx.canvas.width = w;
		this.bgctx.canvas.width = w;
		this.width = w;
		this.init_screen()
	}

	this.set_height = (h) => {
		emulator.screen.bgctx.canvas.height = h;
		emulator.screen.fgctx.canvas.height = h;
		this.height = h;
		this.init_screen()
	}

	this.dei = (port) => {
		switch (port) {
			case 0x22: return this.width >> 8;
			case 0x23: return this.width & 0xf0;
			case 0x24: return this.height >> 8;
			case 0x25: return this.height & 0xf0;
			default: return emulator.uxn.peek8(emulator.uxn.dev + port) ;
		}
	}

	this.set_pixel = (fg, offset, c) => {
	    const img = fg ? this.fgPixels : this.bgPixels;
		const i = offset * 4;
		img[i] = c.r << 4;
		img[i+1] = c.g << 4; 
		img[i+2] = c.b << 4;
		img[i+3] = 255; // a
	}

	this.draw_pixel = (ctrl,x,y,move) => {
		const fg = ctrl & 0x40;
		const color = ctrl & 0x3;
		// fill mode
		if(ctrl & 0x80) {
			let x2 = this.width
			let y2 = this.height
			if(ctrl & 0x10) x2 = x, x = 0;
			if(ctrl & 0x20) y2 = y, y = 0;
			for (let a = 0; a < x2; a++) {
				for (let b = 0; b < y2; b++) {
					this.set_pixel(fg, a + b * this.width, this.colors[color])
				}
			}
		}
		// pixel mode
		this.set_pixel(fg, x + y * this.width, this.colors[color]);
		if (move & 0x1) {
			emu.uxn.poke16(emu.uxn.dev + 0x28, x + 1);
		}
		if (move & 0x2) {
			emu.uxn.poke16(emu.uxn.dev + 0x2a, y + 1);
		}
	}

	// TODO cleanup
	this.draw_sprite = (ctrl, x, y, ptr, move) => {
		const twobpp = (ctrl & 0x80);
		const length = move >> 4;
		// background or foreground canvas
		const color = ctrl & 0xf;
		const width = this.width;
		const height = this.height;
		const opaque = color % 5;
		const flipx = (ctrl & 0x10);
		const fx = flipx ? -1 : 1;
		const flipy = (ctrl & 0x20);
		const fy = flipy ? -1 : 1;

		const dx = (move & 0x1) << 3;
		const dxy = dx * fy;
		const dy = (move & 0x2) << 2;
		const dyx = dy * fx;
		const addr_incr = (move & 0x4) << (1 + twobpp);
		for (let i = 0; i <= length; i++) {
			let x1 = x + dyx * i;
			let y1 = y + dxy * i;
			for (let v = 0; v < 8; v++ ) {
				let c = emu.uxn.ram[(ptr + v) & 0xffff] | (twobpp? (emu.uxn.ram[(ptr + v + 8) & 0xffff] << 8): 0);
				let v1 = (flipy? 7 - v : v);
				for (let h = 7; h >= 0; --h) {
					let ch = (c & 1) | ((c >> 7) & 2);
					if (opaque || ch) {
						let h1 = (flipx? 7 - h : h);
						let offset = x1 + h1 + (y1 + v1) * width;
						if (x < width && y < height) {
							let c = this.colors[blending[ch][color]]
							this.set_pixel(ctrl & 40, offset, c);
						} 
					}
					c = c >> 1;
				}
			}		
			ptr += addr_incr;
		}
		if(move & 0x1) {
			x = x + dx * fx;
			emu.uxn.poke16(emu.uxn.dev + 0x28, x);
		}
		if(move & 0x2) {
			y = y + dy * fy;
			emu.uxn.poke16(emu.uxn.dev + 0x2a, y);
		}
		if(move & 0x4) {
			emu.uxn.poke16(emu.uxn.dev + 0x2c, ptr);
		}
	}

	this.update_palette = () => {
		let r1 = emu.uxn.ram[emu.uxn.dev + 0x8]
		let r2 = emu.uxn.ram[emu.uxn.dev + 0x9]
		let g1 = emu.uxn.ram[emu.uxn.dev + 0xa]
		let g2 = emu.uxn.ram[emu.uxn.dev + 0xb]
		let b1 = emu.uxn.ram[emu.uxn.dev + 0xc]
		let b2 = emu.uxn.ram[emu.uxn.dev + 0xd]
		this.colors[0] = {r: r1 >> 4, g: g1 >> 4, b: b1 >> 4}
		this.colors[1] = {r: r1 & 0xf, g: g1 & 0xf, b: b1 & 0xf}
		this.colors[2] = {r: r2 >> 4, g: g2 >> 4, b: b2 >> 4}
		this.colors[3] = {r: r2 & 0xf, g: g2 & 0xf, b: b2 & 0xf}
		console.log(this.colors)
	}
}
