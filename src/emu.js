'use strict'

function Emu ()
{
	this.debug = 0
	this.uxn = new Uxn(this)
	this.console = new Console(this)
	this.screen = new Screen(this)
	this.datetime = new DateTime(this)
	this.mouse= new Mouse(this)

	let opcodes = [
		"LIT", "INC", "POP", "NIP", "SWP", "ROT", "DUP", "OVR",
		"EQU", "NEQ", "GTH", "LTH", "JMP", "JCN", "JSR", "STH",
		"LDZ", "STZ", "LDR", "STR", "LDA", "STA", "DEI", "DEO",
		"ADD", "SUB", "MUL", "DIV", "AND", "ORA", "EOR", "SFT",
		"BRK"]

	function getname(byte) {
		let m2 = !!(byte & 0x20) ? "2" : ""
		let mr = !!(byte & 0x40) ? "r" : ""
		let mk = !!(byte & 0x80) ? "k" : ""
		return opcodes[byte & 0x1f] + m2 + mk + mr
	}

	this.debugger = () => {
		if(!this.uxn.wst.ptr())
			console.log("Stack is clean")
		// Stack
		let buf = ""
		for (let i = 0; i < this.uxn.wst.ptr(); i++) {
			buf += this.uxn.wst.get(i).toString(16)+" "
		}
		console.warn(buf)
	}

	this.onStep = (pc, instr) => {
		if(this.debug)
			console.log(getname(instr), pc)
	}

	this.dei = (port) => {
		const d = port & 0xf0
		switch (d) {
		case 0xc0: return this.datetime.dei(port)
		case 0x20: return this.screen.dei(port)
		}
		return this.uxn.getdev(port)
	}

	this.deo = (port, val) => {
		this.uxn.setdev(port, val)
		let x, y, move, ctrl = 0;
		switch(port) {
		// System
		case 0x08:
		case 0x09:
		case 0x0a:
		case 0x0b:
		case 0x0c: 
		case 0x0d: this.screen.update_palette(); break;
		case 0x0f: console.warn("Program ended."); break;
		// Console
		case 0x18: this.console.write(val); break;
		case 0x19: this.console.error(val); break;
		// Screen
		case 0x22, 0x23: 
			this.screen.set_width(this.uxn.peek16(this.uxn.dev + 0x22)); break;
		case 0x24, 0x25: 
			this.screen.set_height(this.uxn.peek16(this.uxn.dev + 0x24)); break;
		case 0x2e: 
			x = this.uxn.peek16(this.uxn.dev + 0x28)
			y = this.uxn.peek16(this.uxn.dev + 0x2a)
			move = this.uxn.peek8(this.uxn.dev + 0x26)
			ctrl = this.uxn.peek8(this.uxn.dev + 0x2e)
			this.screen.draw_pixel(ctrl,x,y, move);
			break;
		case 0x2f:
			x = this.uxn.peek16(this.uxn.dev + 0x28)
			y = this.uxn.peek16(this.uxn.dev + 0x2a)
			move = this.uxn.peek8(this.uxn.dev + 0x26)
			ctrl = this.uxn.peek8(this.uxn.dev + 0x2f)
			let ptr = this.uxn.peek16(this.uxn.dev + 0x2c)
			this.screen.draw_sprite(ctrl, x, y, ptr, move);
			break;
		}
	}

	this.pointer_callback = (event) => {
		const bounds = emulator.bgCanvas.getBoundingClientRect();
		const x = emulator.bgCanvas.width * (event.clientX - bounds.left) / bounds.width;
		const y = emulator.bgCanvas.height * (event.clientY - bounds.top) / bounds.height;
		this.mouse.handle_mouse(x,y, event.buttons)
		event.preventDefault();

	}

	this.screen_callback = () => {
		this.uxn.eval(this.uxn.peek16(this.uxn.dev + 0x20))
		this.screen.update_screen()
	}
}
