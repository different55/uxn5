'use strict'

function FileDevice(emu, mask)
{
	let rL1 = 0
	let name = ""
	
	this.init = (addr) => {
		name = ""
		while(emu.uxn.ram[addr])
			name += String.fromCharCode(emu.uxn.ram[addr++]);
		console.log("Init: ", name)
	}
	
	this.read = (id, addr, length) => {
		console.log("Read: ", id, addr, length)
	}
	
	this.write = (id, addr, length, flags) => {
		console.log("Write: ", id, addr, length, flags)
	
	}
	
	this.success = (port, value) => {
		poke16(emu.uxn.dev, 0x0c | mask, value)
	}
	
	this.deo = (addr) => {
		let port = mask
		switch(addr & 0xf) {
			case 0xb:
				rL1 = peek16(emu.uxn.dev, 0x0a | mask);
				return;
			case 0x9:
				this.success(0x2, this.init(peek16(emu.uxn.dev, 0x08 | mask)));
				return;
			case 0xd:
				this.success(0x2, this.read(0, peek16(emu.uxn.dev, 0x0c | mask), rL1));
				return;
			case 0xf:
				this.success(0x2, this.write(0, peek16(emu.uxn.dev, 0x0e | mask), rL1, emu.uxn.dev[0x7 | mask]));
				return;
		}
	}
}
