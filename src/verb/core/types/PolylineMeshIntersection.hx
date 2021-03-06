package verb.core.types;

import verb.core.types.NurbsCurveData.Point;
import verb.core.types.MeshData.UV;

@:expose("core.PolylineMeshIntersection")
class PolylineMeshIntersection {

    public var point : Point;
    public var u : Float;
    public var uv : UV;
    public var polylineIndex : Int;
    public var faceIndex : Int;

    public function new(point, u, uv, polylineIndex, faceIndex){
        this.point = point;
        this.u = u;
        this.uv = uv;
        this.polylineIndex = polylineIndex;
        this.faceIndex = faceIndex;
    }
}