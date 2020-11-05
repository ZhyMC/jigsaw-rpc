import IBuilderManager = require("../protocol/builder/manager/IBuilderManager");
import Packet = require("../protocol/Packet");
import SliceAckPacket = require("../protocol/packet/SliceAckPacket");
import SlicePacket = require("../protocol/packet/SlicePacket");
import IRouter = require("../router/IRouter");
import NetRoute = require("../router/route/NetRoute");
import AbstractHandler = require("./AbstractHandler");

type Handler = (p : Packet) => void;

class SliceHandler extends AbstractHandler{
	protected builder_manager : IBuilderManager<SlicePacket,Packet>;
    protected packet_handler : Handler = ()=>{};
    protected router : IRouter;

    constructor(router : IRouter,builder_manager : IBuilderManager<SlicePacket,Packet>){
        super(router);
        this.router = router;

        this.builder_manager = builder_manager;
        this.router.plug("SlicePacket",this.handlePacket.bind(this));
        
    }
    setHandler(handler : Handler){
        this.packet_handler = handler;
    }
    handlePacket(p : Packet){
        let spk = p as SlicePacket;
        let manager = this.builder_manager;
        
        if(!manager.hasBuilder(spk.buildkey))
            manager.createBuilder(spk.buildkey,spk.partmax);

        
        manager.addPart(spk.buildkey,spk);
        
        if(manager.isDone(spk.buildkey)){
            let built=manager.getBuilt(spk.buildkey);
            if(!built.isBuilt())
                built.decode();
            built.reply_info = spk.reply_info;
            
            
            this.packet_handler(built);
        }

        let ack = new SliceAckPacket();
        ack.request_id = spk.request_id;
        ack.partid = spk.partid;

        this.router.sendPacket(ack,new NetRoute(spk.reply_info.port,spk.reply_info.address));    
    }


}


export = SliceHandler;
