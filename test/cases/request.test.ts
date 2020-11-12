import BaseNetworkClient from "../../src/network/client/BaseNetworkClient"
import AddressInfo from "../../src/network/domain/AddressInfo"
import RegistryClient from "../../src/network/domain/client/RegistryClient"
import RegistryServerInfo from "../../src/network/domain/RegistryServerInfo"
import PacketFactory from "../../src/network/protocol/factory/PacketFactory"
import BaseRequest from "../../src/network/request/BaseRequest"
import SimplePacketRouter from "../../src/network/router/packetrouter/SimplePacketRouter"
import UDPSocket from "../../src/network/socket/UDPSocket"
import RandomGen from "../../src/utils/RandomGen";

function getRegistryClient(socket:UDPSocket ,name:string){
    
    let client = new BaseNetworkClient(socket,new PacketFactory());

    let router = new SimplePacketRouter(client);
    let port = client.getAddressInfo().port;
    let domclient = new RegistryClient(RandomGen.GetRandomHash(8),name,[new AddressInfo("127.0.0.1",port)],port,new RegistryServerInfo("jigsaw","127.0.0.1",3793),[],router);

    return domclient;
}
class TestRequest extends BaseRequest<void>{
    
    getName(){
        return "";
    }
    async send(){
        
    }
    handlePacket(){

    }

}
describe("Request Test",()=>{
    it("should timeout when never build a new request",(done)=>{

        let socket = new UDPSocket();
        let client = new BaseNetworkClient(socket,new PacketFactory());

        let router = new SimplePacketRouter(client);

        let req = new TestRequest(router,0,1000);
        let ref = 0;
        req.getLifeCycle().on("closed",async ()=>{
            ++ref;
        });
        
        req.getLifeCycle().on("dead",async ()=>{
            if(++ref == 2){
                await socket.close();
                done();
            }
        });

    });
})