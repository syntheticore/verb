


//
// Get the intersection of a NURBS curve and a NURBS surface by axis-aligned bounding box intersection and refinement
//
// **params**
// + integer degree of surface in u direction
// + array of nondecreasing knot values in u direction
// + integer degree of surface in v direction
// + array of nondecreasing knot values in v direction
// + 3d array of homogeneous control points, top to bottom is increasing u direction, left to right is increasing v direction,
// and where each control point is an array of length (dim+1)
// + integer degree of curve
// + array of nondecreasing knot values
// + 2d array of homogeneous control points, where each control point is an array of length (dim+1) 
// and form (wi*pi, wi)
// + the sample tolerance of the curve
// + tolerance for the curve intersection
// + integer number of divisions of the surface in the U direction for initial approximation (placeholder until adaptive tess of surfaces)
// + integer number of divisions of the surface in the V direction for initial approximation (placeholder until adaptive tess of surfaces)
// 
// **returns** 
// + array of intersection objects, each holding:
// 	- a "point" property where intersections took place
// 	- a "p" the parameter on the curve
//	- a "uv" the parameter on the surface
// 	- a "face" the index of the face where the intersection took place
//

public static function rational_curve_surface_by_aabb_refine( degree_u, knots_u, degree_v, 
	knots_v, homo_control_points_srf, degree_crv, knots_crv, homo_control_points_crv, sample_tol, tol, 
	divs_u, divs_v ) {

	// get the approximate intersections
	var ints = verb.eval.rational_curve_surface_by_aabb( degree_u, knots_u, degree_v, 
		knots_v, homo_control_points_srf, degree_crv, knots_crv, homo_control_points_crv, sample_tol, tol, 
		divs_u, divs_v );

	// refine them
	return ints.map(function( inter ){

		// get intersection params
		var start_params = [inter.p, inter.uv[0], inter.uv[1] ]

		// refine the parameters
			, refined_params = verb.eval.refine_rational_curve_surface_intersection( degree_u, knots_u, degree_v, knots_v, homo_control_points_srf, degree_crv, knots_crv, homo_control_points_crv, start_params );
	
		// update the inter object
		inter.p = refined_params[0];
		inter.uv[0] = refined_params[1];
		inter.uv[1] = refined_params[2];
		inter.distance = refined_params[3];
		delete inter.face;

		return inter;

	});

}

//
//
//
// Refine an intersection pair for a surface and curve given an initial guess.  This is an unconstrained minimization,
// so the caller is responsible for providing a very good initial guess.
//
// **params**
// + integer degree of surface in u direction
// + array of nondecreasing knot values in u direction
// + integer degree of surface in v direction
// + array of nondecreasing knot values in v direction
// + 3d array of homogeneous control points, top to bottom is increasing u direction, left to right is increasing v direction,
// and where each control point is an array of length (dim+1)
// + integer degree of curve
// + array of nondecreasing knot values
// + 2d array of homogeneous control points, where each control point is an array of length (dim+1) 
// and form (wi*pi, wi)
// + array of initial parameter values [ u_crv, u_srf, v_srf ]
// 
// **returns** 
// + a length 3 array containing the [ u_crv, u_srf, v_srf, final_distance ]
//

public static function refine_rational_curve_surface_intersection( degree_u, knots_u, degree_v, knots_v, homo_control_points_srf, degree_crv, knots_crv, homo_control_points_crv, start_params ) {

	var objective = function(x) { 

		var p1 = verb.eval.rational_curve_point(degree_crv, knots_crv, homo_control_points_crv, x[0])
			, p2 = verb.eval.rational_surface_point( degree_u, knots_u,  degree_v, knots_v, homo_control_points_srf, x[1], x[2] )
			, p1_p2 = Vec.sub(p1, p2);

		return Vec.dot(p1_p2, p1_p2);
	}

	var sol_obj = Vec.uncmin( objective, start_params);
	return sol_obj.solution.concat( sol_obj.f );

}



//
//
//
// Approximate the intersection of two nurbs surface by axis-aligned bounding box intersection.
//
// **params**
// + integer degree of surface in u direction
// + array of nondecreasing knot values in u direction
// + integer degree of surface in v direction
// + array of nondecreasing knot values in v direction
// + 3d array of homogeneous control points, top to bottom is increasing u direction, left to right is increasing v direction,
// and where each control point is an array of length (dim+1)
// + integer degree of curve
// + array of nondecreasing knot values
// + 2d array of homogeneous control points, where each control point is an array of length (dim+1) 
// and form (wi*pi, wi)
// + array of initial parameter values [ u_crv, u_srf, v_srf ]
// + the sample tolerance of the curve
// + tolerance for the curve intersection
// + integer number of divisions of the surface in the U direction
// + integer number of divisions of the surface in the V direction
// 
// **returns** 
// + array of intersection objects, each holding:
// 	- a "point" property where intersections took place
// 	- a "p" the parameter on the polyline
//	- a "uv" the parameter on the mesh
// 	- a "face" the index of the face where the intersection took place
//

public static function rational_curve_surface_by_aabb( degree_u, knots_u, degree_v, knots_v, homo_control_points_srf, degree_crv, knots_crv, homo_control_points_crv, sample_tol, tol, divs_u, divs_v ) {

	// tessellate the curve
	var crv = verb.eval.rational_curve_adaptive_sample( degree_crv, knots_crv, homo_control_points_crv, sample_tol, true)

	// tessellate the surface
		, mesh = verb.eval.tessellate_rational_surface_naive( degree_u, knots_u, degree_v, knots_v, homo_control_points_srf, divs_u, divs_v )

	// separate parameters from points in the polyline (params are the first index in the array)
		, u1 = crv.map( function(el) { return el[0]; })
		, p1 = crv.map( function(el) { return el.slice(1) })

	// perform intersection
		, res = verb.eval.parametric_polyline_mesh_by_aabb( p1, u1, mesh, verb.range(mesh.faces.length), tol );

	// eliminate duplicate intersections
	return verb.unique( res, function(a, b){
		return Vec.norm( Vec.sub( a.point, b.point ) ) < tol && Math.abs( a.p - b.p ) < tol && Vec.norm( Vec.sub( a.uv, b.uv ) ) < tol
	});

}

//
//
//
// Approximate the intersection of a polyline and mesh while maintaining parameter information
//
// **params**
// + array of 3d points on the curve
// + array of parameters corresponding to the parameters on the curve
// + *Object*, a triangular mesh with a "faces" attribute and "points" attribute
// + an array of indices, representing the faces to include in the intersection operation
// + tolerance for the intersection
// 
// **returns** 
// + array of intersection objects (with potential duplicates ) each holding:
// 	- a "point" property where intersections took place
// 	- a "p" the parameter on the polyline
//	- a "uv" the parameter on the mesh
// 	- a "face" the index of the face where the intersection took place
//

public static function parametric_polyline_mesh_by_aabb( crv_points, crv_param_points, mesh, included_faces, tol ) {

	// check if two bounding boxes intersect
	var pl_bb = new verb.BoundingBox( crv_points )
		, mesh_bb = verb.eval.make_mesh_aabb( mesh.points, mesh.faces, included_faces )
		, rec = verb.eval.parametric_polyline_mesh_by_aabb;

	// if bounding boxes do not intersect, return empty array
	if ( !pl_bb.intersects( mesh_bb, tol ) ) {
		return [];
	}

	if ( crv_points.length === 2 && included_faces.length === 1 ){

			// intersect segment and triangle

			var inter = verb.eval.segment_with_tri( crv_points[0], crv_points[1], mesh.points, mesh.faces[ included_faces[0] ] );

			if ( inter != null ){

				// map the parameters of the segment to the parametric space of the entire polyline
			 	var p = inter.p * ( crv_param_points[1]-crv_param_points[0] ) + crv_param_points[0];

			 	// map the parameters of the single triangle to the entire parametric space of the triangle
			 	var index_v0 = mesh.faces[ included_faces ][0]
			 		, index_v1 = mesh.faces[ included_faces ][1]
			 		, index_v2 = mesh.faces[ included_faces ][2]
			 		, uv_v0 = mesh.uvs[ index_v0 ]
			 		, uv_v1 = mesh.uvs[ index_v1 ]
			 		, uv_v2 = mesh.uvs[ index_v2 ]
			 		, uv_s_diff = Vec.sub( uv_v1, uv_v0 )
			 		, uv_t_diff = Vec.sub( uv_v2, uv_v0 )
			 		, uv = Vec.add( uv_v0, Vec.mul( inter.s, uv_s_diff ), Vec.mul( inter.t, uv_t_diff ) );

			 	// a pair representing the param on the polyline and the param on the mesh
			 	return [ { point: inter.point, p: p, uv: uv, face: included_faces[0] } ]; 

			}

	} else if ( included_faces.length === 1 ) {

		// intersect triangle and polyline

		// divide polyline in half, rightside includes the pivot
		var crv_points_a = verb.left( crv_points )
			, crv_points_b = verb.rightWithPivot( crv_points )
			, crv_param_points_a = verb.left( crv_param_points )
			, crv_param_points_b = verb.rightWithPivot( crv_param_points );

		return 	 rec( crv_points_a, crv_param_points_a, mesh, included_faces, tol )
		.concat( rec( crv_points_b, crv_param_points_b, mesh, included_faces, tol ) );

	
	} else if ( crv_points.length === 2 ) {

		// intersect mesh >2 faces and line

		// divide mesh in "half" by first sorting then dividing array in half
		var sorted_included_faces = verb.eval.sort_tris_on_longest_axis( mesh_bb, mesh.points, mesh.faces, included_faces )
			, included_faces_a = verb.left( sorted_included_faces )
			, included_faces_b = verb.right( sorted_included_faces );

		return 		 rec( crv_points, crv_param_points, mesh, included_faces_a, tol )
			.concat( rec( crv_points, crv_param_points, mesh, included_faces_b, tol ));


	} else { 

		// intersect mesh with >2 faces and polyline

		// divide mesh in "half"
		var sorted_included_faces = verb.eval.sort_tris_on_longest_axis( mesh_bb, mesh.points, mesh.faces, included_faces )
			, included_faces_a = verb.left( sorted_included_faces )
			, included_faces_b = verb.right( sorted_included_faces );

		// divide polyline in half, rightside includes the pivot
		var crv_points_a = verb.left( crv_points )
			, crv_points_b = verb.rightWithPivot( crv_points )
			, crv_param_points_a = verb.left( crv_param_points )
			, crv_param_points_b = verb.rightWithPivot( crv_param_points );

		return 	 	 rec( crv_points_a, crv_param_points_a, mesh, included_faces_a, tol )
			.concat( rec( crv_points_a, crv_param_points_a, mesh, included_faces_b, tol ) )
			.concat( rec( crv_points_b, crv_param_points_b, mesh, included_faces_a, tol ) )
			.concat( rec( crv_points_b, crv_param_points_b, mesh, included_faces_b, tol ) );

	}

	return [];

}

//
//


//
//


//
//
//
//  Intersect two aabb trees - a recursive function
//
// **params**
// + array of length 3 arrays of numbers representing the points of mesh1
// + array of length 3 arrays of number representing the triangles of mesh1
// + array of length 3 arrays of numbers representing the points of mesh2
// + array of length 3 arrays of number representing the triangles of mesh2
// + *Object*, nested object representing the aabb tree of the first mesh
// + *Object*, nested object representing the aabb tree of the second mesh
// 
// **returns** 
// + a list of pairs of triangle indices for mesh1 and mesh2 that are intersecting
//

public static function aabb_trees( points1, tris1, points2, tris2, aabb_tree1, aabb_tree2 ) {

  var intersects = aabb_tree1.bounding_box.intersects( aabb_tree2.bounding_box );

  var recur = verb.eval.aabb_trees;

  if (!intersects){
  	return [];
  }

  if (aabb_tree1.children.length === 0 && aabb_tree2.children.length === 0){ 

  	return [ [aabb_tree1.triangle, aabb_tree2.triangle ] ]; 

  } else if (aabb_tree1.children.length === 0 && aabb_tree2.children.length != 0){

  	return     recur( points1, tris1, points2, tris2, aabb_tree1, aabb_tree2.children[0] )
  		.concat( recur( points1, tris1, points2, tris2, aabb_tree1, aabb_tree2.children[1] ) );

  } else if (aabb_tree1.children.length != 0 && aabb_tree2.children.length === 0){

  	return     recur( points1, tris1, points2, tris2, aabb_tree1.children[0], aabb_tree2 )
  		.concat( recur( points1, tris1, points2, tris2, aabb_tree1.children[1], aabb_tree2 ) );

  } else if (aabb_tree1.children.length != 0 && aabb_tree2.children.length != 0){

  	return     recur( points1, tris1, points2, tris2, aabb_tree1.children[0], aabb_tree2.children[0] )
  		.concat( recur( points1, tris1, points2, tris2, aabb_tree1.children[0], aabb_tree2.children[1] ) )
  		.concat( recur( points1, tris1, points2, tris2, aabb_tree1.children[1], aabb_tree2.children[0] ) )
  		.concat( recur( points1, tris1, points2, tris2, aabb_tree1.children[1], aabb_tree2.children[1] ) );

  }

}

//
//


//
//


//
//

//
//
//
// Get triangle centroid
//
// **params**
// + array of length 3 arrays of numbers representing the points
// + length 3 array of point indices for the triangle
// 
// **returns** 
// + a point represented by an array of length 3
//

public static function get_tri_centroid( points, tri ) {

	var centroid = [0,0,0];

	for (var i = 0; i < 3; i++){
		for (var j = 0; j < 3; j++){
			centroid[j] += points[ tri[i] ][j];
		}
	}

	for (var i = 0; i < 3; i++){
		centroid[i] /= 3;
	}

	return centroid;

};

//
//
//
// Get triangle normal
//
// **params**
// + array of length 3 arrays of numbers representing the points
// + length 3 array of point indices for the triangle
// 
// **returns** 
// + a normal vector represented by an array of length 3
//

public static function get_tri_norm( points, tri ) {

	var v0 = points[ tri[0] ]
		, v1 = points[ tri[1] ]
		, v2 = points[ tri[2] ]
		, u = Vec.sub( v1, v0 )
		, v = Vec.sub( v2, v0 )
		, n = Vec.cross( u, v );

	return Vec.mul( 1 / Vec.norm( n ), n );

};

//
//
//
// Approximate the intersection of two nurbs surface by axis-aligned bounding box intersection and then refine all solutions.
//
// **params**
// + integer degree of curve1
// + array of nondecreasing knot values for curve 1
// + 2d array of homogeneous control points, where each control point is an array of length (dim+1) and form (wi*pi, wi) for curve 1
// + integer degree of curve2
// + array of nondecreasing knot values for curve 2
// + 2d array of homogeneous control points, where each control point is an array of length (dim+1) and form (wi*pi, wi) for curve 2
// + tolerance for the intersection
// 
// **returns** 
// + a 2d array specifying the intersections on u params of intersections on curve 1 and cruve 2
//

public static function rational_curves_by_aabb_refine( degree1, knots1, homo_control_points1, degree2, knots2, homo_control_points2, sample_tol, tol ) {

	var ints = verb.eval.rational_curves_by_aabb( degree1, knots1, homo_control_points1, degree2, knots2, homo_control_points2, sample_tol, tol );

	return ints.map(function(start_params){
		return verb.eval.refine_rational_curve_intersection( degree1, knots1, homo_control_points1, degree2, knots2, homo_control_points2, start_params )
	});

}


//
//
//
// Refine an intersection pair for two curves given an initial guess.  This is an unconstrained minimization,
// so the caller is responsible for providing a very good initial guess.
//
// **params**
// + integer degree of curve1
// + array of nondecreasing knot values for curve 1
// + 2d array of homogeneous control points, where each control point is an array of length (dim+1) 
 									// and form (wi*pi, wi) for curve 1
// + integer degree of curve2
// + array of nondecreasing knot values for curve 2
// + 2d array of homogeneous control points, where each control point is an array of length (dim+1) 
 									// and form (wi*pi, wi) for curve 2
// + length 2 array with first param guess in first position and second param guess in second position
// 
// **returns** 
// + a length 3 array containing the [ distance// distance, u1, u2 ]
//

public static function refine_rational_curve_intersection( degree1, knots1, control_points1, degree2, knots2, control_points2, start_params ) {

	var objective = function(x) { 

		var p1 = verb.eval.rational_curve_point(degree1, knots1, control_points1, x[0])
			, p2 = verb.eval.rational_curve_point(degree2, knots2, control_points2, x[1])
			, p1_p2 = Vec.sub(p1, p2);

		return Vec.dot(p1_p2, p1_p2);
	}

	var sol_obj = Vec.uncmin( objective, start_params);
	return sol_obj.solution.concat( sol_obj.f );

}

//
//
//
// Approximate the intersection of two nurbs surface by axis-aligned bounding box intersection.
//
// **params**
// + integer degree of curve1
// + array of nondecreasing knot values for curve 1
// + 2d array of homogeneous control points, where each control point is an array of length (dim+1) and form (wi*pi, wi) for curve 1
// + integer degree of curve2
// + array of nondecreasing knot values for curve 2
// + 2d array of homogeneous control points, where each control point is an array of length (dim+1) and form (wi*pi, wi) for curve 2
// + tolerance for the intersection
// 
// **returns** 
// + array of parameter pairs representing the intersection of the two parameteric polylines
//

public static function rational_curves_by_aabb( degree1, knots1, homo_control_points1, degree2, knots2, homo_control_points2, sample_tol, tol ) {

	var up1 = verb.eval.rational_curve_adaptive_sample( degree1, knots1, homo_control_points1, sample_tol, true)
		, up2 = verb.eval.rational_curve_adaptive_sample( degree2, knots2, homo_control_points2, sample_tol, true)
		, u1 = up1.map( function(el) { return el[0]; })
		, u2 = up2.map( function(el) { return el[0]; })
		, p1 = up1.map( function(el) { return el.slice(1) })
		, p2 = up2.map( function(el) { return el.slice(1) });

	return verb.eval.parametric_polylines_by_aabb( p1, p2, u1, u2, tol );

}

//
//
//
// Intersect two polyline curves, keeping track of parameterization on each
//
// **params**
// + array of point values for curve 1
// + array of parameter values for curve 1, same length as first arg
// + array of point values for curve 2
// + array of parameter values for curve 2, same length as third arg
// + tolerance for the intersection
// 
// **returns** 
// + array of parameter pairs representing the intersection of the two parameteric polylines
//

public static function parametric_polylines_by_aabb( p1, p2, u1, u2, tol ) {

	var bb1 = new verb.BoundingBox(p1)
		, bb2 = new verb.BoundingBox(p2);

	if ( !bb1.intersects(bb2, tol) ) {
		return [];
	}

	if (p1.length === 2 && p2.length === 2 ){

			var inter = verb.eval.segments(p1[0],p1[1], p2[0], p2[1], tol);

			if ( inter != null ){

				// map the parameters of the segment to the parametric space of the entire polyline
			 	inter[0][0] = inter[0][0] * ( u1[1]-u1[0] ) + u1[0];
			 	inter[1][0] = inter[1][0] * ( u2[1]-u2[0] ) + u2[0];

			 	return [ [ inter[0][0], inter[1][0] ] ];

			} 

	} else if (p1.length === 2) {

		var p2_mid = Math.ceil( p2.length / 2 ),
				p2_a = p2.slice( 0, p2_mid ),
				p2_b = p2.slice( p2_mid-1 ),
				u2_a = u2.slice( 0, p2_mid ),
				u2_b = u2.slice( p2_mid-1 );

		return 	 verb.eval.parametric_polylines_by_aabb(p1, p2_a, u1, u2_a, tol)
		.concat( verb.eval.parametric_polylines_by_aabb(p1, p2_b, u1, u2_b, tol) );

	} else if (p2.length === 2) {

		var p1_mid = Math.ceil( p1.length / 2 ),
				p1_a = p1.slice( 0, p1_mid ),
				p1_b = p1.slice( p1_mid-1 ),
				u1_a = u1.slice( 0, p1_mid ),
				u1_b = u1.slice( p1_mid-1 );

		return 		 verb.eval.parametric_polylines_by_aabb(p1_a, p2, u1_a, u2, tol)
			.concat( verb.eval.parametric_polylines_by_aabb(p1_b, p2, u1_b, u2, tol) );

	} else {

		var p1_mid = Math.ceil( p1.length / 2 ),
				p1_a = p1.slice( 0, p1_mid ),
				p1_b = p1.slice( p1_mid-1 ),
				u1_a = u1.slice( 0, p1_mid ),
				u1_b = u1.slice( p1_mid-1 ),

				p2_mid = Math.ceil( p2.length / 2 ),
				p2_a = p2.slice( 0, p2_mid ),
				p2_b = p2.slice( p2_mid-1 ),
				u2_a = u2.slice( 0, p2_mid ),
				u2_b = u2.slice( p2_mid-1 );

		return 		 verb.eval.parametric_polylines_by_aabb(p1_a, p2_a, u1_a, u2_a, tol)
			.concat( verb.eval.parametric_polylines_by_aabb(p1_a, p2_b, u1_a, u2_b, tol) )
			.concat( verb.eval.parametric_polylines_by_aabb(p1_b, p2_a, u1_b, u2_a, tol) )
			.concat( verb.eval.parametric_polylines_by_aabb(p1_b, p2_b, u1_b, u2_b, tol) );

	}

	return [];

}

//
//
//
// Find the closest parameter on two rays, see http://geomalgorithms.com/a07-_distance.html
//
// **params**
// + first point on a
// + second point on a
// + first point on b
// + second point on b
// + tolerance for the intersection
// 
// **returns** 
// + a 2d array specifying the intersections on u params of intersections on curve 1 and cruve 2
//

public static function segments( a0, a1, b0, b1, tol ) {

	// get axis and length of segments
	var a1ma0 = Vec.sub(a1, a0),
			aN = Math.sqrt( Vec.dot(a1ma0, a1ma0) ),
			a = Vec.mul( 1/ aN, a1ma0 ),
			b1mb0 = Vec.sub(b1, b0),
			bN = Math.sqrt( Vec.dot(b1mb0, b1mb0) ),
			b = Vec.mul( 1 / bN, b1mb0 ),
			int_params = verb.eval.rays(a0, a, b0, b);

	if ( int_params != null ) {

		var u1 = Math.min( Math.max( 0, int_params[0] / aN ), 1.0),
				u2 = Math.min( Math.max( 0, int_params[1] / bN ), 1.0),
				int_a = Vec.add( Vec.mul( u1, a1ma0 ), a0 ),
				int_b = Vec.add( Vec.mul( u2, b1mb0 ), b0 ),
				dist = Vec.normSquared( Vec.sub(int_a, int_b) );

		if (  dist < tol*tol ) {
			return [ [u1].concat(int_a), [u2].concat(int_b) ] ;
		} 

	}
	
	return null;

 }

//
// Find the closest parameter on two rays, see http://geomalgorithms.com/a07-_distance.html
//
// **params**
// + origin for ray 1
// + direction of ray 1, assumed normalized
// + origin for ray 1
// + direction of ray 1, assumed normalized
// 
// **returns** 
// + a 2d array specifying the intersections on u params of intersections on curve 1 and curve 2
//

public static function rays( a0, a, b0, b ) {

   var dab = Vec.dot( a, b ),
		   dab0 = Vec.dot( a, b0 ),
		   daa0 = Vec.dot( a, a0 ),
		   dbb0 = Vec.dot( b, b0 ),
		   dba0 = Vec.dot( b, a0 ),
		   daa = Vec.dot( a, a ),
		   dbb = Vec.dot( b, b ),
		   div = daa*dbb - dab*dab;

	// parallel case
   if ( Math.abs( div ) < verb.EPSILON ) { 
	   return null;
   }

   var num = dab * (dab0-daa0) - daa * (dbb0-dba0),
   		 w = num / div,
			 t = (dab0 - daa0 + w * dab)/daa;

		return [t, w];

}

public static function three_planes(n0, d0, n1, d1, n2, d2){

	var u = Vec.cross( n1, n2 );
	var den = Vec.dot( n0, u );

	if (Math.abs(den) < verb.EPSILON) return null;

	var num = Vec.add(
							Vec.mul( d0, u ), 
							Vec.cross( n0, 
								Vec.sub( 	Vec.mul( d2, n1 ), Vec.mul( d1, n2 ) )));

	return Vec.mul( 1 / den, num );

}

public static function refine_rational_surface_point(uv1, uv2, degree_u1, knots_u1, degree_v1, knots_v1, homo_control_points1, degree_u2, knots_u2, degree_v2, knots_v2, homo_control_points2, tol){

 var pds, p, pn, pu, pv, pd, qds, q, qn, qu, qv, qd, dist;
 var maxits = 1;
 var its = 0;

 var r = function(u, v){
 	return verb.eval.rational_surface_derivs( degree_u1, knots_u1, degree_v1, knots_v1, 
			homo_control_points1, 1, u, v );
 }

 var s = function(u, v){
 	return verb.eval.rational_surface_derivs( degree_u2, knots_u2, degree_v2, knots_v2, 
			homo_control_points2, 1, u, v );
 }

 do {

	// 1) eval normals, pts on respective surfaces (p, q, pn, qn)

		pds = r( uv1[0], uv1[1] );
		p = pds[0][0];
		pu = pds[1][0];
		pv = pds[0][1];
		pn = Vec.normalized( Vec.cross( pu, pv ) );
		pd = Vec.dot( pn, p );
		
		qds = s( uv2[0], uv2[1] );
		q = qds[0][0];
		qu = qds[1][0];
		qv = qds[0][1];
		qn = Vec.normalized( Vec.cross( qu, qv ) );
		qd = Vec.dot( qn, q );

		// if tolerance is met, exit loop
		dist = Vec.norm( Vec.sub(p, q) );

		
		if (dist < tol) {
			break;
		}

 	// 2) construct plane perp to both that passes through p (fn)

		var fn = Vec.normalized( Vec.cross( pn, qn ) );
		var fd = Vec.dot( fn, p );

 	// 3) x = intersection of all 3 planes
		var x = verb.eval.three_planes( pn, pd, qn, qd, fn, fd );

		if (x === null) throw new Error("panic!")

 	// 4) represent the difference vectors (pd = x - p, qd = x - q) in the partial 
	// 		derivative vectors of the respective surfaces (pu, pv, qu, qv)

		var pdif = Vec.sub( x, p );
		var qdif = Vec.sub( x, q );

		var rw = Vec.cross( pu, pn ); 
		var rt = Vec.cross( pv, pn );

		var su = Vec.cross( qu, qn );
		var sv = Vec.cross( qv, qn );

		var dw = Vec.dot( rt, pdif ) / Vec.dot( rt, pu );
		var dt = Vec.dot( rw, pdif ) / Vec.dot( rw, pv );

		var du = Vec.dot( sv, qdif ) / Vec.dot( sv, qu );
		var dv = Vec.dot( su, qdif ) / Vec.dot( su, qv );

		uv1 = Vec.add( [dw, dt], uv1 );
		uv2 = Vec.add( [du, dv], uv2 );

 	// repeat
 		its++;

 } while( its < maxits ) // tolerance is not met? not sure what this should be

 return {uv1: uv1, uv2: uv2, pt: p, d: dist };

}

public static function rational_surface_surface_by_aabb_refine( degree_u1, knots_u1, degree_v1, knots_v1, homo_control_points_srf1, degree_u2, knots_u2, degree_v2, knots_v2, homo_control_points_srf2, tol ) {

	// 1) tessellate the meshes to get the approximate intersections
	var srfObj1 = {
		degree_u : degree_u1,
		degree_v : degree_v1,
		knots_u : knots_u1,
		knots_v : knots_v1,
		homo_control_points : homo_control_points_srf1
	};

	// todo: need to be able to predict the number of divisions

	var tess1 = verb.eval.tessellate_rational_surface_adaptive( srfObj1.degree_u,
		srfObj1.knots_u,
		srfObj1.degree_v,
		srfObj1.knots_v, 
		srfObj1.homo_control_points);

	var srfObj2 = {
		degree_u : degree_u2,
		degree_v : degree_v2,
		knots_u : knots_u2,
		knots_v : knots_v2,
		homo_control_points : homo_control_points_srf2
	};

	var tess2 = verb.eval.tessellate_rational_surface_adaptive( srfObj2.degree_u,
		srfObj2.knots_u,
		srfObj2.degree_v,
		srfObj2.knots_v, 
		srfObj2.homo_control_points);

	var resApprox = verb.eval.meshes_by_aabb( tess1.points, tess1.faces, tess1.uvs, tess2.points, tess2.faces, tess2.uvs );

	// 2) refine the intersection points so that they lie on both surfaces
	var exactPls = resApprox.map(function(pl){
		return pl.map( function(inter){
			return verb.eval.refine_rational_surface_point(inter.uvtri1, inter.uvtri2, degree_u1, knots_u1, degree_v1, knots_v1, homo_control_points_srf1, 
				degree_u2, knots_u2, degree_v2, knots_v2, homo_control_points_srf2, tol );
		});
	});

	// 3) perform cubic interpolation
	return exactPls.map(function(x){
		return verb.eval.rational_interp_curve( x.map(function(x){ return x.pt; }), 3 ); 
	});

	// TODO: represent this in uv space
	// TODO: refine between initial points

}

public static function meshes_by_aabb( points1, tris1, uvs1, points2, tris2, uvs2 ) {

	// build aabb for each mesh
	var tri_indices1 = verb.range(tris1.length)
	  , tri_indices2 = verb.range(tris2.length)
	  , aabb1 = verb.eval.make_mesh_aabb_tree( points1, tris1, tri_indices1 )
	  , aabb2 = verb.eval.make_mesh_aabb_tree( points2, tris2, tri_indices2 );

  // intersect and get the pairs of triangle intersctions
	var bbints = verb.eval.aabb_trees( points1, tris1, points2, tris2, aabb1, aabb2 );

	// get the segments of the intersection crv with uvs
	var segments = bbints.map(function(ids){
													var res = verb.eval.tris( points1, tris1[ ids[0] ], uvs1, points2, tris2[ ids[1] ], uvs2 );
													if (!res) return res;

													res[0].tri1id = ids[0];
													res[1].tri1id = ids[0];
													res[0].tri2id = ids[1];
													res[1].tri2id = ids[1];

													return res;
												}).filter(function(x){ return x; })
												.filter(function(x){ 
													var dif = Vec.sub( x[0].pt, x[1].pt );
													return Vec.dot( dif, dif ) > verb.EPSILON 
												});

	// TODO: this is too expensive and this only occurs when the intersection
	// 			 line is on an edge.  we should mark these to avoid doing all of 
	//			 these computations
	segments = verb.unique( segments, function(a, b){

		var s1 = Vec.sub( a[0].uvtri1, b[0].uvtri1 );
		var d1 = Vec.dot( s1, s1 );

		var s2 = Vec.sub( a[1].uvtri1, b[1].uvtri1 );
		var d2 = Vec.dot( s2, s2 );

		var s3 = Vec.sub( a[0].uvtri1, b[1].uvtri1 );
		var d3 = Vec.dot( s3, s3 );

		var s4 = Vec.sub( a[1].uvtri1, b[0].uvtri1 );
		var d4 = Vec.dot( s4, s4 );

		return ( d1 < verb.EPSILON && d2 < verb.EPSILON ) || 
			( d3 < verb.EPSILON && d4 < verb.EPSILON );

	});

	if (segments.length === 0) return [];

	return verb.eval.make_polylines( segments );

}


public static function make_polylines( segments ) {

	// debug (return all segments)
	// return segments;

	// we need to be able to traverse from one end of a segment to the other
	segments.forEach( function(s){
		s[1].opp = s[0];
		s[0].opp = s[1];
	});

	// construct a tree for fast lookup 
	var tree = verb.eval.kdtree_from_segs( segments );

	// flatten everything, we no longer need the segments
	var ends = segments.flatten();

	// step 1: assigning the vertices to the segment ends 
	ends.forEach(function(segEnd){

			if (segEnd.adj) return;

			var adjEnd = verb.eval.lookup_adj_segment( segEnd, tree, segments.length );

			if (adjEnd && !adjEnd.adj){

				segEnd.adj = adjEnd;
				adjEnd.adj = segEnd;

			} 

		});

	// step 2: traversing the topology to construct the pls
	var freeEnds = ends.filter(function(x){
		return !x.adj;
	});

	// if you cant find one, youve got a loop (or multiple), we run through all
	if (freeEnds.length === 0) {
		freeEnds = ends;
	}

	var pls = [];
	
	freeEnds.forEach(function(end){

		if (end.v) return;

		// traverse to end
		var pl = [];
		var curEnd = end;

		while (curEnd) {

			// debug
			if (curEnd.v) throw new Error('Segment end encountered twice!');

			// technically we consume both ends of the segment
			curEnd.v = true;
			curEnd.opp.v = true;

			pl.push(curEnd);

			curEnd = curEnd.opp.adj;

			// loop condition
			if (curEnd === end) break;

		}

		if (pl.length > 0) {
			pl.push( pl[pl.length-1].opp );
			pls.push( pl );
		}

	})

	return pls;

}

public static function pt_dist(a, b){
  return Math.pow(a.x - b.x, 2) + Math.pow(a.y - b.y, 2) + Math.pow(a.z - b.z, 2);
};

public static function kdtree_from_segs( segments ){

	var treePoints = [];

	// for each segment, transform into two elements, each keyed by pt1 and pt2
	segments.forEach(function(seg){
		treePoints.push({ "x": seg[0].pt[0], "y": seg[0].pt[1], "z": seg[0].pt[2], ele: seg[0] });
		treePoints.push({ "x": seg[1].pt[0], "y": seg[1].pt[1], "z": seg[1].pt[2], ele: seg[1] });
	});

	// make our tree
	return new KdTree(treePoints, verb.eval.pt_dist, ["x", "y", "z"]);

}

public static function lookup_adj_segment( segEnd, tree, numSegments ) {

	var numResults = numSegments ? Math.min( numSegments, 3 ) : 3;

	// we look up 3 elements because we need to find the unique adj ele
	// we expect one result to be self, one to be neighbor and no more
	var adj = tree.nearest({ x: segEnd.pt[0], y: segEnd.pt[1], z: segEnd.pt[2] }, numResults)
								.filter(function(r){ 
									return segEnd != r[0].ele && r[1] < verb.EPSILON;
								})
								.map(function(r){ return r[0].ele; });

	// there may be as many as 1 duplicate pt

	// if its not unique (i.e. were at a branching point) we dont return it
	return (adj.length === 1) ? adj[0] : null;

}

//
//
//
// Intersect two triangles
//
// **params**
// + array of length 3 arrays of numbers representing the points of mesh1
// + array of length 3 arrays of number representing the triangles of mesh1
// + array of length 3 arrays of numbers representing the points of mesh2
// + array of length 3 arrays of number representing the triangles of mesh2
// 
// **returns** 
// + a point represented by an array of length (dim)
//

public static function tris( points1, tri1, uvs1, points2, tri2, uvs2 ){

	// 0) get the plane rep of the two triangles
	var n0 = verb.eval.get_tri_norm( points1, tri1 );
	var n1 = verb.eval.get_tri_norm( points2, tri2 );
	var o0 = points1[ tri1[0] ];
	var o1 = points2[ tri2[0] ];

// TODO: fail early if all of the points of tri1 are on the same side of plane of tri2
// TODO: mark appropriately if the intersection is along an edge
	
	// 1) intersect with planes to yield ray of intersection
	var ray = verb.eval.planes(o0, n0, o1, n1);
	if (!ray.intersects) return null;

	// 2) clip the ray within tri1
	var clip1 = verb.eval.clip_ray_in_coplanar_tri( ray.origin, ray.dir, points1, tri1, uvs1 );
	if (clip1 === null) return null;

	// 3) clip the ray within tri2
	var clip2 = verb.eval.clip_ray_in_coplanar_tri( ray.origin, ray.dir, points2, tri2, uvs2 );
	if (clip2 === null) return null;

	// 4) find the interval that overlaps
	var merged = verb.eval.merge_tri_clip_intervals(clip1, clip2, points1, tri1, uvs1, points2, tri2, uvs2 );
	if (merged === null) return null;

	return [ 	{ uvtri1 : merged.uv1tri1, uvtri2: merged.uv1tri2, pt: merged.pt1 }, 
						{ uvtri1 : merged.uv2tri1, uvtri2: merged.uv2tri2, pt: merged.pt2 } ];

}

public static function clip_ray_in_coplanar_tri(o1, d1, points, tri, uvs ){

	// 0) construct rays for each edge of the triangle
	var o = [ points[ tri[0] ], points[ tri[1] ], points[ tri[2] ] ]

		, uvs = [ uvs[ tri[0] ], uvs[ tri[1] ], uvs[ tri[2] ] ]

		, uvd = [ Vec.sub(uvs[1], uvs[0]), Vec.sub(uvs[2], uvs[1]), Vec.sub(uvs[0], uvs[2]) ] 

		, s = [ Vec.sub( o[1], o[0] ), Vec.sub( o[2], o[1] ), Vec.sub( o[0], o[2] ) ]

		, d = s.map( Vec.normalized )
		, l = s.map( Vec.norm )

	// 1) for each tri ray, if intersects and in segment interval, store minU, maxU
	var minU = null;
	var maxU = null;

	// need to clip in order to maximize the width of the intervals

	for (var i = 0; i < 3; i++){

		var o0 = o[i];
		var d0 = d[i];

		var res = verb.eval.rays( o0, d0, o1, d1 );

		// the rays are parallel
		if (res === null) {
			continue;
		}

		var useg = res[0];
		var uray = res[1];

		// if outside of triangle edge interval, discard
		if (useg < -verb.EPSILON || useg > l[i] + verb.EPSILON) continue;

		// if inside interval
		if (minU === null || uray < minU.u){
			minU = { 	u: uray, 
								pt: verb.eval.point_on_ray( o1, d1, uray ),
								uv: Vec.add( uvs[i], Vec.mul( useg / l[i], uvd[i] ) ) };

		}

		if (maxU === null || uray > maxU.u){
			maxU = { 	u: uray, 
								pt: verb.eval.point_on_ray( o1, d1, uray ),
								uv: Vec.add( uvs[i], Vec.mul( useg / l[i], uvd[i] ) ) };

		}
	}

	if (maxU === null || minU === null) {
		return null;
	}

	// 3) otherwise, return minU maxU along with uv info
	return { min : minU, max: maxU };
	
}

public static function point_on_ray(o, d, u){

	return Vec.add( o, Vec.mul( u, d ));

}

public static function merge_tri_clip_intervals(clip1, clip2, points1, tri1, uvs1, points2, tri2, uvs2){

	// if the intervals dont overlap, fail
	if (clip2.min.u > clip1.max.u + verb.EPSILON 
		|| clip1.min.u > clip2.max.u + verb.EPSILON) {
		return null;
	}

	// label each clip to indicate which triangle it came from
	clip1.min.tri = 0;
	clip1.max.tri = 0;
	clip2.min.tri = 1;
	clip2.max.tri = 1;

	// are these assigned properly?  

	var min = (clip1.min.u > clip2.min.u) ? clip1.min : clip2.min;
	var max = (clip1.max.u < clip2.max.u) ? clip1.max : clip2.max;

	var res = {};

	if (min.tri === 0){

		res.uv1tri1 = min.uv;
		res.uv1tri2 = verb.eval.tri_uv_from_point( points2, tri2, uvs2, min.pt );

	} else {

		res.uv1tri1 = verb.eval.tri_uv_from_point( points1, tri1, uvs1, min.pt );
		res.uv1tri2 = min.uv;

	}

	res.pt1 = min.pt;

	if (max.tri === 0){

		res.uv2tri1 = max.uv;
		res.uv2tri2 = verb.eval.tri_uv_from_point( points2, tri2, uvs2, max.pt );

	} else {

		res.uv2tri1 = verb.eval.tri_uv_from_point( points1, tri1, uvs1, max.pt );
		res.uv2tri2 = max.uv;

	}

	res.pt2 = max.pt;

	return res;

}

public static function planes(o1, n1, o2, n2){

	var d = Vec.cross(n1, n2);

	if (Vec.dot(d, d) < verb.EPSILON) return { intersects: false };

	// find the largest index of d
	var li = 0;
	var mi = Math.abs( d[0] );
	var m1 = Math.abs( d[1] );
	var m2 = Math.abs( d[2] );

	if ( m1 > mi ){
		li = 1;
		mi = m1;
	}

	if ( m2 > mi ){
		li = 2;
		mi = m2;
	}

	var a1, b1, a2, b2;

	if ( li === 0 ){
		a1 = n1[1];
		b1 = n1[2];
		a2 = n2[1];
		b2 = n2[2];
	} else if ( li === 1 ){
		a1 = n1[0];
		b1 = n1[2];
		a2 = n2[0];
		b2 = n2[2];
	} else {
		a1 = n1[0];
		b1 = n1[1];
		a2 = n2[0];
		b2 = n2[1];
	}

	// n dot X = d
	var d1 = -Vec.dot( o1, n1 );
	var d2 = -Vec.dot( o2, n2 );

	var den = a1 * b2 - b1 * a2;

	var x = (b1 * d2 - d1 * b2) / den;
	var y = (d1 * a2 - a1 * d2) / den;
	var p;

	if ( li === 0 ){
		p = [0,x,y];
	} else if ( li === 1 ){
		p = [x,0,y];
	} else {
		p = [x,y,0];
	}

	return { intersects: true, origin: p, dir : Vec.normalized( d ) };

}

public static function tri_uv_from_point( points, tri, uvs, f ){

	var p1 = points[ tri[0] ];
	var p2 = points[ tri[1] ];
	var p3 = points[ tri[2] ];

	var uv1 = uvs[ tri[0] ];
	var uv2 = uvs[ tri[1] ];
	var uv3 = uvs[ tri[2] ];

	var f1 = Vec.sub(p1, f);
	var f2 = Vec.sub(p2, f);
	var f3 = Vec.sub(p3, f);

	// calculate the areas and factors (order of parameters doesn't matter):
	var a = Vec.norm( Vec.cross( Vec.sub(p1, p2), Vec.sub(p1, p3) ) ); // main triangle area a
	var a1 = Vec.norm( Vec.cross(f2, f3) ) / a; // p1's triangle area / a
	var a2 = Vec.norm( Vec.cross(f3, f1) ) / a; // p2's triangle area / a 
	var a3 = Vec.norm( Vec.cross(f1, f2) ) / a; // p3's triangle area / a

	// find the uv corresponding to point f (uv1/uv2/uv3 are associated to p1/p2/p3):
	return Vec.add( Vec.mul( a1, uv1), Vec.mul( a2, uv2), Vec.mul( a3, uv3) );

}