import Packet from "../protocol/Packet";
import Path from "./Path";
import RequestState from "./RequestState";
import BaseRequest from "./BaseRequest"
import InvokePacket from "../protocol/packet/InvokePacket";
import InvokeReplyPacket from "../protocol/packet/InvokeReplyPacket";
import SliceAckPacket from "../protocol/packet/SliceAckPacket";
import PacketSlicer from "../request/PacketSlicer";
import InvokeTimeoutError from "../../error/request/InvokeTimeoutError";
import InvokeRemoteError from "../../error/request/InvokeRemoteError";
import ErrorPacket from "../protocol/packet/ErrorPacket";
import IRouter from "../router/IRouter";
import IDomainClient from "../domain/client/IDomainClient";
import RegistryRoute from "../router/route/RegistryRoute";


class InvokeRequest extends BaseRequest<Buffer> {
    private path : Path;
    private data : Buffer;
    private src_jgname : string;
    private packet_slicer : PacketSlicer;
    private registryClient : IDomainClient;
    private route : RegistryRoute;

    protected router : IRouter;
    
    constructor(src_jgname: string,path : Path,data : Buffer,registryClient:IDomainClient,router : IRouter,seq:number){
        super(router,seq,10*1000); // 10s timeout

        this.router = router;

        this.path = path;
        this.data = data;
        this.src_jgname = src_jgname;
        this.registryClient = registryClient;
        this.route = new RegistryRoute(this.path.jgname,this.registryClient);
            
        this.packet_slicer = new PacketSlicer(this.buildPacket(),this.getRequestId());

        this.getLifeCycle().on("closed",()=>{
            this.packet_slicer.close();
        });

        
        this.preloadDomain();
    }
    private buildPacket(){
        let pk=new InvokePacket();
        pk.request_id = this.getRequestId();

        pk.data=this.data;
        pk.dst_path=this.path;
        pk.src_jgname = this.src_jgname;

        pk.encode();

        return pk;
    }

    private async preloadDomain(){
        try{
            
            await this.route.preload();
            this.getLifeCycle().setState("ready");
        }catch(err){
            this.getLifeCycle().setDead(err);
        }
        
    }
    public getName(){
        return "InvokeRequest";
    }
    protected async send() : Promise<void>{
        if(this.packet_slicer.isAllDone()){
            if(this.packet_slicer.isFailed())
                throw new Error("packet slicer failed");
            
            await this.router.sendPacket(this.packet_slicer.getEmptySlice(),this.route);
        }else{
            let sliceids = this.packet_slicer.getPartSlices();
            for(let sliceid of sliceids){
                await this.router.sendPacket(this.packet_slicer.getSlicePacket(sliceid),this.route);
            }
        } 
    }
    protected getTimeoutError(){
        return new InvokeTimeoutError(this.timeout_duration,this.src_jgname,this.path.toString(),this.data.length,this.req_seq);
    }
    protected handleErrorPacket(p : Packet){
        let pk = p as ErrorPacket;
        throw new InvokeRemoteError(pk.error,this.src_jgname,this.path.toString(),this.data.length,this.req_seq);
    }
    protected handlePacket(p : Packet){
        if(this.getLifeCycle().getState()!="closing")
            return;
            
        if(p.getName() == "InvokeReplyPacket"){
            let pk = p as InvokeReplyPacket;
            let data = pk.data;
            p.release();

            this.setResult(data);
        }else if(p.getName() == "SliceAckPacket"){
            let pk = p as SliceAckPacket;
            
            this.packet_slicer.ackSlicePacket(pk.partid);
        }
    }
    
}

export default InvokeRequest;
