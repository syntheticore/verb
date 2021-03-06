package verb.topo;

import verb.topo.Split.PlanePosition;
import verb.topo.Split.PlanePosition;
import verb.topo.Split.PlanePosition;
import verb.topo.Split.EdgePlanePosition;
import verb.core.types.Exception;
import haxe.ds.IntMap;
import verb.core.Constants;
import verb.core.Vec;
using verb.core.Vec;
import verb.core.types.NurbsCurveData.Point;
import verb.core.types.Pair;
import verb.core.Intersect;

import verb.core.types.DoublyLinkedListExtensions;
using verb.core.types.DoublyLinkedListExtensions;

typedef Plane = {
    n : Array<Float>,
    o : Array<Float>
}

typedef EdgePlanePosition = {
    edge : HalfEdge,
    pos : PlanePosition
}

enum PlanePosition { On; Above; Below; }

@:expose("topo.Split")
class Split {

    public static function split( s : Solid, p : Plane ) : Pair<Solid,Solid> {

        // intersect
        var r = intersect(s, p);

        // identify crossing edges and coplanar vertices
        var vs : IntMap<Vertex> = new IntMap<Vertex>();
        for (ir in r){
            var v : Vertex;
            if ( isCrossingEdge(ir.item1) ){
                v = splitEdge(ir.item0, ir.item1).v;
            } else {
                v = ir.item0.v;
            }

            if (!vs.exists(v.id)){
                vs.set(v.id, v);
            }
        }

        var nulledges = new Array<HalfEdge>();
        var crossing = false;

        for (v in vs.iterator()){

            // now we need to classify the edges emanating
            // from our coplanar vertices
            var ecs : Array<EdgePlanePosition> = classifyVertex( v, p );

            // find the first in ABOVE seq
            var i = nextOfClass( PlanePosition.Above, ecs, 0 );

            // there's no above edge in the seq (all below), continue
            if (i == -1) break;

            // if all of the edges are of the same type, just continue
            if (nextOfClass( PlanePosition.Below, ecs, 0 ) == -1) break;

            // if we've reached this point, at least one vertex is crossing
            crossing = true;

            var start = ecs[i].edge;
            var head = start;
            var tail = start;
            var el = ecs.length;

            while(true){

                // find the end of the ABOVE sequence
                while (ecs[i].pos == PlanePosition.Above){
                    tail = ecs[i].edge;
                    i = (i + 1) % el;
                }

                // insert a null edge
                s.lmev( head, tail.opp.nxt, head.v.pt.copy() );
                var ne = head.prv;
                nulledges.push( ne );

                // find the next start sequence and assign to head
                i = nextOfClass( PlanePosition.Above, ecs, i );

                // there is no other above edge, we're done with this vertex
                if (i == -1) break;

                head = ecs[i].edge;

                // we've come back to the beginning (should never happen)
                if (head == start) break;
            }
        }

        // there are no crossing edges, this might happen if the plane is coplanar with a face
        if (!crossing){
            return null;
        }

        // now we have all of the null edges inserted and need to separate the solid
        // into two pieces

        // lexicographical sort of the null edges
        sortNullEdges( nulledges );

        var h0 : HalfEdge;
        var h1 : HalfEdge;

        var looseends = [];
        var afaces = [];
        for (ne in nulledges){
            if ( (h0 = canJoin( ne, looseends )) != null ){
                join( h0, ne );
                if (!isLoose(h0.opp, looseends)) cut(h0, afaces);
            }

            if ( (h1 = canJoin( ne.opp, looseends )) != null ){
                join( h1, ne.opp );
                if (!isLoose(h1.opp, looseends)) cut(h1, afaces);
            }

            if (h0 != null && h1 != null) cut(ne, afaces);
        }

        // close the two solids
        var bfaces = [for (f in afaces) s.lmfkrh(f.l)];

        // classify the top and bottom of the solid
        var a : Solid = new Solid();
        var b : Solid = new Solid();

        for (f in afaces) moveFace( f, a );
        for (f in bfaces) moveFace( f, b );

        cleanup(a, s);
        cleanup(b, s);

        return new Pair(b,a);
    }

    public static function classifyVertex( v : Vertex, p : Plane ) :  Array<EdgePlanePosition> {

        var ecs = new Array<EdgePlanePosition>();

        // 1. classify vertex edges based on opposite vertex's signed distance from the cutting plane
        for (e in v.halfEdges()){
            ecs.push({ edge: e, pos : classify(e, p) });

            // for each edge, we also need to check the sector width - i.e. the angle
            // bisector between two adjacent edges. If more than 180, we bisect the edge
            if ( wideSector(e) ){
                ecs.push({ edge: e, pos : classifyBisector(e, p) });
            }
        }

        // 2. now, for each "on" edge, we need to determine its face - is this face aligned with the plane normal?
        // if so,
        //      if aligned with plane normal (dot(fn, sp) > 0), BELOW, along with the next edge
        //      else ABOVE
        var el = ecs.length;
        for (i in 0...el){
            var ep = ecs[i];
            if (ep.pos == PlanePosition.On){
                var nc = reclassifyCoplanarSector(ep.edge, p);
                ecs[i].pos = nc;
                ecs[(i+1) % el].pos = nc;
            }
        }

        // 3. now, go through all of the edges, search for ON edges, reclassify them based on rules on pg 245
        for (i in 0...el){
            var ep = ecs[i];
            if (ep.pos == PlanePosition.On){

                var a = i == 0 ? el : i-1;
                var b = (i+1) % el;

                var prv = ecs[a].pos;
                var nxt = ecs[b].pos;

                // TODO: this could be simplified but let's keep for debugging purposes
                if ( prv == PlanePosition.Above && nxt == PlanePosition.Above ){
                    ep.pos = PlanePosition.Below;
                } else if ( prv == PlanePosition.Below && nxt == PlanePosition.Above ) {
                    ep.pos = PlanePosition.Below;
                } else if ( prv == PlanePosition.Above && nxt == PlanePosition.Below ) {
                    ep.pos = PlanePosition.Below;
                } else if ( prv == PlanePosition.Below && nxt == PlanePosition.Below ) {
                    ep.pos = PlanePosition.Above;
                } else {
                    throw new Exception("Double On edge encountered!");
                }
            }
        }

        return ecs;
    }

    private static function moveFace( f : Face, s : Solid ) : Void {
        if (f.s == s ) return;

        f.s.f = f.s.f.kill( f );
        s.f = s.f.push( f );
        f.s = s;

        for (nf in f.neighbors()){
            moveFace( nf, s );
        }
    }

    // move vertices of ks to s by traversing the faces of s
    private static function cleanup( s : Solid, ks : Solid ) : Void {
        var memo = new IntMap<Vertex>();

        for (f in s.f.iter()){
            for (l in f.l.iter()){
                for (v in l.vertices()){
                    if (!memo.exists( v.id )){
                        memo.set( v.id, v );
                        ks.v = ks.v.kill( v );
                        s.v = s.v.push( v );
                    }
                }
            }
        }
    }

    private static function canJoin( e : HalfEdge, looseends : Array<HalfEdge> ) : HalfEdge {
        for (i in 0...looseends.length){
            if ( neighbor( e, looseends[i]) ){  //
                var r = looseends[i];
                looseends.splice(i, 1);
                return r;
            }
        }

        looseends.push(e);
        return null;
    }

    private static function neighbor( e0 : HalfEdge, e1 : HalfEdge ) : Bool {
        return e0.l.f == e1.l.f; // || e0.opp == e1;    // opposite orientation
    }

    private static function isLoose( e : HalfEdge, le : Array<HalfEdge> ) : Bool {
        return le.indexOf(e) != -1;
    }

    // join a new null edge into the expanding slice polygon
    private static function join( e0 : HalfEdge, e1 : HalfEdge ) {
        var of = e0.l.f;
        var nf : Face = null;
        var s = e0.l.f.s;

        if (e0.l == e1.l){
            if (e0.prv.prv != e1){
                nf = s.lmef( e0, e1.nxt );
            }
        } else {
            s.lmekr( e0, e1.nxt );
        }

        if (e0.nxt.nxt != e1){
            s.lmef( e1, e0.nxt );
            if (nf != null && of.l.nxt != of.l){
                trace('PANIC!');
                // TODO - move internal rings to the new face as appropriate
                // s.laringmv(of, nf);
            }
        }
    }

    // remove a null edge
    private static function cut( e : HalfEdge, faces : Array<Face> ) {
        if (e.l == e.opp.l){
            faces.push(e.l.f);
            e.l.f.s.lkemr( e );
        } else {
            e.l.f.s.lkef( e );
        }
    }

    private static function sortNullEdges( es : Array<HalfEdge> ){
        es.sort(function(a : HalfEdge, b : HalfEdge){
            var ap = a.v.pt;
            var bp = b.v.pt;

            // lexicographical sort
            if (ap[0] < bp[0]) {
                return -1;
            } else if (ap[0] > bp[0]) {
                return 1;
            } else if (ap[1] < bp[1]) {
                return -1;
            } else if (ap[1] > bp[1]) {
                return 1;
            } else if (ap[2] < bp[2]) {
                return -1;
            } else if (ap[2] > bp[2]) {
                return 1;
            }

            return 0;
        });
    }

    private static function nextOfClass( cl : PlanePosition, ecs : Array<EdgePlanePosition>, start : Int ) : Int {
        var i = start;
        var head : EdgePlanePosition = null;
        while (i < ecs.length){
            if ( ecs[i].pos == cl ) {
                head = ecs[i];
                break;
            }
            i++;
        }
        return head != null ? i : -1;
    }

    public static function wideSector ( e : HalfEdge ) : Bool {
        var n = e.l.f.normal();

        var a = e.nxt.v.pt.sub(e.v.pt).normalized();
        var b = e.prv.v.pt.sub(e.v.pt).normalized();

        return a.signedAngleBetween(b, n) > Math.PI;
    }

    public static function classifyBisector( e : HalfEdge, p : Plane ) : PlanePosition {
        return classifyPoint( Vec.mul( 0.5, e.nxt.v.pt.add(e.prv.v.pt) ), p);
    }

    private static function reclassifyCoplanarSector( e : HalfEdge, p : Plane ) : PlanePosition {

        var n = e.l.f.normal(); // TODO: cache me
        var n1 = e.opp.l.f.normal(); // TODO: cache me

        var ndc = n.dot(p.n);
        var ndc1 = n1.dot(p.n);

        var eps2 = Constants.EPSILON * Constants.EPSILON;

        if ( Math.abs(ndc - 1.0) < eps2 || Math.abs(ndc1 - 1.0) < eps2 ) {
            return PlanePosition.Below;
        }

        if ( Math.abs(ndc + 1.0) < eps2 || Math.abs(ndc1 + 1.0) < eps2 ) {
            return PlanePosition.Above;
        }

        return PlanePosition.On;
    }

    public static function classify(e : HalfEdge, p : Plane) : PlanePosition {
        return classifyPoint( e.nxt.v.pt, p );
    }

    private static function classifyPoint(pt : Array<Float>, p : Plane) : PlanePosition {
        var s = pt.sub( p.o ).dot( p.n );

        if (Math.abs(s) < Constants.EPSILON) return PlanePosition.On;
        if (s > 0.0) return PlanePosition.Above else return PlanePosition.Below;
    }

    private static function intersect( s : Solid, p : Plane ) : Array<Pair<HalfEdge,Float>> {
        var is = [];
        for (e in s.edges()){

            var he : HalfEdge = e.item0;

            var r = verb.core.Intersect.segmentAndPlane(he.v.pt, he.nxt.v.pt, p.o, p.n );

            if (r == null) continue;

            if (r.p > 1.0 - Constants.EPSILON) {
                r.p = 0.0;
                he = he.nxt;
            }

            is.push( new Pair(he, r.p) );
        }
        return is;
    }

    public static function splitEdge( e : HalfEdge, p : Float ) : HalfEdge {
        var s = e.l.f.s;

        // given the intersecting halfedge, is there a way to use the euler operators?
        var pt0 = pointOnHalfEdge( e, p );
        var pt1 = pt0.copy();

        // insert a coincident vertices along the HalfEdge
        var nv = s.lmev( e, e.opp.nxt, pt1 );

        return nv.e;
    }

    private static function isCrossingEdge( p : Float ){
        return p < 1.0 - Constants.EPSILON && p > Constants.EPSILON;
    }

    private static function pointOnHalfEdge( e : HalfEdge, p : Float ) : Point {
        return Vec.lerp( p, e.nxt.v.pt, e.v.pt );
    }

    public static function intersectionPoints( s : Solid, p : Plane ) : Array<Point> {
        return [ for (i in intersect(s,p)) pointOnHalfEdge( i.item0, i.item1 ) ];
    }
}


