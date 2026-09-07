"""RLSW cosmic arena: editable Blender source + optimized browser GLB.

Run from the repository: blender --background --python scripts/cosmic-arena/build_scene.py
Coordinates come from output/cosmic-arena/hex-map.json, exported from the live map.
The supplied board2.png is a silhouette/placement reference, not a baked 3D illusion.
"""
import bpy
import math
import random
import json
from pathlib import Path
from mathutils import Vector
from collections import defaultdict

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / 'output' / 'cosmic-arena'
OUT.mkdir(parents=True, exist_ok=True)
random.seed(8437)
bpy.ops.object.select_all(action='SELECT')
bpy.ops.object.delete(use_global=False)
scene = bpy.context.scene
scene.unit_settings.system = 'METRIC'
GROUPS = {}
CURRENT = 'Stage'
BUFFERS = {}

def material(name, color, metallic=0.0, roughness=0.5, emission=0.0):
    m = bpy.data.materials.new(name)
    m.diffuse_color = (*color, 1)
    m.use_nodes = True
    p = m.node_tree.nodes.get('Principled BSDF')
    p.inputs['Base Color'].default_value = (*color, 1)
    p.inputs['Metallic'].default_value = metallic
    p.inputs['Roughness'].default_value = roughness
    p.inputs['Emission Color'].default_value = (*color, 1)
    p.inputs['Emission Strength'].default_value = emission
    return m

deck = material('Obsidian stage', (.021, .035, .065), .45, .65)
tile = material('Hex ceramic', (.035, .057, .095), .35, .6)
armor = material('Amp midnight indigo', (.035, .023, .14), .5, .58)
steel = material('Brushed titanium', (.17, .21, .29), .82, .33)
black = material('Speaker graphite', (.008, .011, .023), .2, .85)
cone = material('Speaker cone', (.035, .045, .065), .55, .4)
cyan = material('Hex cyan', (.015, .54, .72), .3, .35, 2.0)
pink = material('Rim magenta', (.68, .012, .43), .3, .3, 3.0)
violet = material('Crack violet', (.25, .025, .8), .2, .5, 3.4)
white = material('Concert ice', (.45, .8, 1), .1, .3, 5)
amber = material('Status amber', (1, .26, .025), .1, .3, 3)
rocks = [material('Basalt facet %02d' % i, (.032+i*.006, .04+i*.006, .068+i*.008), .25, .9) for i in range(8)]

def register(obj, mat):
    obj.data.materials.append(mat)
    if CURRENT not in GROUPS:
        g = bpy.data.objects.new(CURRENT, None)
        scene.collection.objects.link(g)
        GROUPS[CURRENT] = g
    obj.parent = GROUPS[CURRENT]
    return obj

def mesh(name, verts, faces, mat):
    # Batch raw geometry before touching Blender's dependency graph. Adding
    # thousands of operators one at a time otherwise makes generation quadratic.
    key=(CURRENT,mat.name)
    if key not in BUFFERS: BUFFERS[key]=[[],[],mat]
    vs,fs,_=BUFFERS[key]; offset=len(vs)
    vs.extend([tuple(v) for v in verts])
    fs.extend([tuple(i+offset for i in f) for f in faces])

def box(name, loc, size, mat, rotation=0):
    ca,sa=math.cos(rotation),math.sin(rotation)
    vs=[]
    for x,y,z in [(-1,-1,-1),(1,-1,-1),(1,1,-1),(-1,1,-1),(-1,-1,1),(1,-1,1),(1,1,1),(-1,1,1)]:
        x*=size[0]/2;y*=size[1]/2;z*=size[2]/2
        vs.append((loc[0]+x*ca-y*sa,loc[1]+x*sa+y*ca,loc[2]+z))
    return mesh(name,vs,[(3,2,1,0),(4,5,6,7),(0,1,5,4),(1,2,6,5),(2,3,7,6),(3,0,4,7)],mat)

def tube(name, points, radius, mat, vertices=6):
    for a, b in zip(points, points[1:]):
        a, b = Vector(a), Vector(b)
        d = b-a
        if d.length < .001:
            continue
        disk(name,(a+b)/2,radius,d.length,mat,d,vertices)

def prism(name, outline, bottom, top, mat):
    n = len(outline)
    vs = [(x,y,bottom) for x,y in outline] + [(x,y,top) for x,y in outline]
    return mesh(name, vs, [tuple(reversed(range(n))),tuple(range(n,2*n))] + [(i,(i+1)%n,(i+1)%n+n,i+n) for i in range(n)],mat)

def disk(name, loc, radius, depth, mat, normal=(0,0,1), vertices=24, top_radius=None):
    rotation=Vector(normal).to_track_quat('Z','Y')
    vs=[];n=vertices
    for r,z in [(radius,-depth/2),(radius if top_radius is None else top_radius,depth/2)]:
        for i in range(n):vs.append(Vector(loc)+rotation@Vector((r*math.cos(i*math.tau/n),r*math.sin(i*math.tau/n),z)))
    return mesh(name,vs,[tuple(reversed(range(n))),tuple(range(n,2*n))]+[(i,(i+1)%n,(i+1)%n+n,i+n) for i in range(n)],mat)

def polyline(name, xy, z, r, mat, closed=True):
    ps=[(x,y,z) for x,y in xy]
    tube(name,ps+[ps[0]] if closed else ps,r,mat)

outline=[(-7.3,-9.12),(7.3,-9.12),(11.36,-2.03),(11.36,2.03),(7.3,9.12),(-7.3,9.12),(-11.36,2.03),(-11.36,-2.03)]
prism('Reinforced stage slab',outline,-.52,-.025,deck)
polyline('Magenta perimeter',outline,.025,.055,pink)
polyline('Titanium edge',[(x*1.018,y*1.018) for x,y in outline],-.18,.085,steel)
polyline('Lower perimeter',[(x*1.014,y*1.014) for x,y in outline],-.43,.025,cyan)

hexes=json.loads((OUT/'hex-map.json').read_text())
for h in hexes:
    x,y=h['x'],h['z']
    corners=[(x+.94*math.cos(i*math.pi/3), y+.94*math.sin(i*math.pi/3)) for i in range(6)]
    prism('Hex %03d'%h['num'],corners,-.024,.004,tile)
    polyline('Grid trace',corners,.013,.009,cyan)
    # Broken corner accents preserve the supplied cyan bracket treatment.
    for i,p in enumerate(corners):
        prev=corners[(i-1)%6]; nxt=corners[(i+1)%6]
        a=(p[0]+(prev[0]-p[0])*.19,p[1]+(prev[1]-p[1])*.19)
        b=(p[0]+(nxt[0]-p[0])*.19,p[1]+(nxt[1]-p[1])*.19)
        polyline('Hex corner', [a,p,b],.022,.024,cyan,False)
center=[(2.08*math.cos(i*math.pi/3),2.08*math.sin(i*math.pi/3)) for i in range(6)]
polyline('Limelight hex',center,.038,.046,pink)
disk('Hub medallion',(0,0,.018),.61,.025,steel,vertices=6)
disk('Hub core',(0,0,.038),.42,.022,violet,vertices=6)

# Rock rings follow the actual octagonal stage, so the stage has a continuous
# physical underside. Sparse open seams light the facets instead of flooding them.
CURRENT='Island'
N=48
rim=[]
for i in range(N):
    e=i//6; t=(i%6)/6
    a=outline[e];b=outline[(e+1)%8]
    rim.append((a[0]*(1-t)+b[0]*t,a[1]*(1-t)+b[1]*t))
rings=[]
for layer,(scale,z) in enumerate([(1.09,-.46),(1.13,-1.65),(.87,-3.85),(.49,-6.5),(.11,-8.45)]):
    ring=[]
    for x,y in rim:
        jitter=random.uniform(.94,1.06)
        ring.append((x*scale*jitter+layer*.09,y*scale*jitter-layer*.07,z+random.uniform(-.48,.25)))
    rings.append(ring)
for j in range(len(rings)-1):
    for i in range(N):
        a=rings[j][i]; b=rings[j][(i+1)%N]; c=rings[j+1][i];d=rings[j+1][(i+1)%N]
        mesh('Fractured basalt', [a,b,c,d],[(0,2,1),(1,2,3)],random.choice(rocks))
        if i%7==1 or (j==1 and i%9==2):
            # Lift the fissure slightly off its rock face to avoid z-fighting.
            pts=[tuple(Vector(p)+Vector((p[0],p[1],0)).normalized()*.035) for p in [a,c,d]]
            tube('Energy fissure',pts,.024 if j>0 else .036,violet)
            if j==1:
                tube('Fissure core',pts[:2],.009,pink)
mesh('Rock crown',rings[0], [tuple(range(N))],rocks[3])
mesh('Keel',rings[-1]+[(.5,-.3,-9.5)],[(i,N,(i+1)%N) for i in range(N)],rocks[0])
for i in range(18):
    a=random.random()*math.tau
    loc=(math.cos(a)*random.uniform(3,8),math.sin(a)*random.uniform(3,7),random.uniform(-5.5,-2))
    bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=1,radius=1,location=loc)
    o=bpy.context.object;o.name='Sheared cliff';o.scale=(random.uniform(.6,1.5),random.uniform(.5,1.2),random.uniform(1.3,2.3));register(o,random.choice(rocks))

# Every amp follows a bent two-segment footprint outside a stage vertex.
# Shared rock foundations and steel saddles join it to the island, with no gap.
amp_manifest=[]
for idx,corner in enumerate(outline):
    label=['NW','NE','E-N','E-S','SE','SW','W-S','W-N'][idx]
    CURRENT='Amp_'+label
    p=Vector(corner); prev=Vector(outline[(idx-1)%8]);nxt=Vector(outline[(idx+1)%8])
    u=(prev-p).normalized();v=(nxt-p).normalized()
    length=2.0 if idx in [0,1,4,5] else 1.5
    route=[p+u*length,p,p+v*length]
    outside=[]
    for point in route:
        outside.append(point+point.normalized()*1.34)
    footprint=[tuple(k) for k in route]+[tuple(k) for k in reversed(outside)]
    prism('Foundation saddle',footprint,-.42,.08,steel)
    height=1.58 if idx in [0,1,4,5] else 1.35
    prism('Bent amp cabinet',footprint,.08,height,armor)
    polyline('Cabinet crown',footprint,height+.012,.027,pink)
    polyline('Cabinet kick rail',footprint,.16,.032,cyan)
    centerp=sum([Vector(q) for q in footprint],Vector((0,0)))/len(footprint)
    amp_manifest.append({'id':label,'x':centerp.x,'z':centerp.y,'height':height,'footprint':footprint})
    # Two speaker faces on each arm, pointing into the arena.
    for a,b in zip(route,route[1:]):
        tangent=(b-a).normalized(); mid=(a+b)/2
        normal=Vector((tangent.y,-tangent.x))
        if normal.dot(-mid)<0:normal=-normal
        n3=Vector((normal.x,normal.y,0))
        for t in [.27,.73]:
            pos=a+(b-a)*t+normal*.028
            for z in [.52,1.06] if height>1.4 else [.45,.96]:
                base=Vector((pos.x,pos.y,z))
                disk('Speaker steel surround',base,.247,.07,steel,n3)
                disk('Speaker diaphragm',base+n3*.045,.211,.05,black,n3,top_radius=.165)
                disk('Speaker dustcap',base+n3*.074,.076,.035,cone,n3)
                disk('Speaker center light',base+n3*.095,.028,.009,cyan,n3,vertices=12)
        for t in [.2,.35,.5,.65,.8]:
            pos=a+(b-a)*t+normal*.035
            disk('Amp control knob',(pos.x,pos.y,height-.14),.031,.055,amber if t==.5 else steel,n3,vertices=10)
        # Cabinet ribs and rear heatsink.
        for t in [.17,.33,.5,.67,.83]:
            pos=a+(b-a)*t-normal*1.21
            tube('Heatsink',[(pos.x,pos.y,.28),(pos.x,pos.y,height-.2)],.026,steel)
    CURRENT='Island'
    # An attached buttress descends into the parent cliff beneath each amp.
    disk('Amp rock buttress',(centerp.x,centerp.y,-1.0),1.15,2.15,rocks[3],vertices=5,top_radius=1.6)
    tube('Amp anchor strut',[(centerp.x,centerp.y,-.32),(centerp.x*.7,centerp.y*.7,-2.8)],.16,steel)

# Four grandstands tucked between the amp stations, on supported rock terraces.
for sx,sy in [(-1,-1),(1,-1),(1,1),(-1,1)]:
    CURRENT='Stands'
    origin=Vector((sx*10.5,sy*6.25)); normal=(-origin).normalized();tangent=Vector((-normal.y,normal.x))
    rot=math.atan2(tangent.y,tangent.x)
    for row in range(4):
        c=origin-normal*(row*.4)
        z=.08+row*.23
        box('Grandstand tier',(c.x,c.y,z),(2.25-row*.15,.42,.19),deck,rot)
        a=c-tangent*(1.12-row*.075);b=c+tangent*(1.12-row*.075)
        tube('Grandstand light',[(a.x,a.y,z+.1),(b.x,b.y,z+.1)],.026,pink)
        for seat in range(7-row):
            q=c+tangent*((seat-(6-row)/2)*.25)
            box('Seat',(q.x,q.y,z+.17),(.16,.19,.12),armor,rot)
    CURRENT='Island'
    disk('Stand rock terrace',(origin.x,origin.y,-1.2),.6,3.1,rocks[4],vertices=6,top_radius=2.0)
    tube('Terrace tie',[(origin.x,origin.y,-.35),(origin.x*.7,origin.y*.7,-2.2)],.21,steel)

# Low truss lighting at the cardinal sides. Nothing hangs across the tactical view.
CURRENT='Lighting'
for sx,sy in [(-1,-1),(1,-1),(-1,1),(1,1)]:
    x=sx*9.5;y=sy*7.5
    for off in [-.12,.12]:tube('Truss upright',[(x+off,y,-.25),(x+off,y,3.65)],.035,steel)
    for j in range(7):
        z=j*.5
        tube('Truss brace',[(x-.12,y,z),(x+.12,y,z+.5)],.025,steel)
    box('Light bar',(x,y,3.6),(.9,.25,.18),black)
    for dx in [-.29,0,.29]:
        normal=Vector((-sx*.3,-sy*.25,-1)).normalized()
        disk('Concert fixture',(x+dx,y,3.48),.12,.16,steel,normal)
        disk('Concert lens',Vector((x+dx,y,3.48))+normal*.09,.095,.025,white,normal)

# Merge static meshes by parent and material: editable meaningful groups without
# thousands of draw calls in a browser. All transforms are baked by Blender join.
for (group,matname),(verts,faces,mat) in BUFFERS.items():
    CURRENT=group
    d=bpy.data.meshes.new(group+' '+matname);d.from_pydata(verts,[],faces);d.update()
    o=bpy.data.objects.new(group+' '+matname,d);scene.collection.objects.link(o);register(o,mat)
print('Batched geometry constructed',len(BUFFERS),flush=True)
bpy.ops.object.select_all(action='DESELECT')
batches=defaultdict(list)
for obj in list(scene.objects):
    if obj.type=='MESH': batches[(obj.parent.name,obj.data.materials[0].name)].append(obj)
for (group,mat),objects in batches.items():
    for o in objects:o.select_set(True)
    bpy.context.view_layer.objects.active=objects[0]
    if len(objects)>1:bpy.ops.object.join()
    bpy.context.object.name=group+' — '+mat
    bpy.ops.object.select_all(action='DESELECT')

scene.world.color=(.08,.08,.08)
scene.world.use_nodes=True
scene.world.node_tree.nodes['Background'].inputs[0].default_value=(.04,.065,.12,1)
scene.world.node_tree.nodes['Background'].inputs[1].default_value=.5
def light(name,loc,color,power,size):
    d=bpy.data.lights.new(name,'AREA');d.energy=power;d.color=color;d.shape='DISK';d.size=size
    o=bpy.data.objects.new(name,d);scene.collection.objects.link(o);o.location=loc
    o.rotation_euler=(-o.location).to_track_quat('-Z','Y').to_euler()
light('Cool key',(2,-12,19),(.52,.76,1),4000,14)
light('Violet rim',(-14,7,6),(.45,.15,1),3500,10)
light('Front rock fill',(6,-15,-2),(.23,.45,1),2600,11)
bpy.ops.object.camera_add(location=(30,-39,29))
cam=bpy.context.object;cam.name='Arena camera';cam.rotation_euler=(Vector((0,0,-1.8))-cam.location).to_track_quat('-Z','Y').to_euler();cam.data.lens=44
scene.camera=cam
scene.render.engine='CYCLES';scene.cycles.samples=32
scene.render.resolution_x=1600;scene.render.resolution_y=1100;scene.render.resolution_percentage=100
scene.render.image_settings.file_format='PNG'
scene.render.film_transparent=False
scene.render.filepath=str(OUT/'blender-preview.png')
scene.view_settings.view_transform='AgX'
scene['design_reference']='board2.png supplied 2026-09-06; eight bent perimeter amps, attached foundations'
scene['board_hex_count']=len(hexes)
scene['preview_scope']='Environment and interaction study; live game port pending visual review'
bpy.ops.wm.save_as_mainfile(filepath=str(OUT/'cosmic-arena.blend'))
bpy.ops.export_scene.gltf(filepath=str(OUT/'cosmic-arena.glb'),export_format='GLB',export_lights=False,export_cameras=False,export_extras=True,export_yup=True)
(OUT/'amp-layout.json').write_text(json.dumps(amp_manifest,indent=2))
report={'hexes':len(hexes),'amp_stations':len(amp_manifest),'mesh_objects':sum(o.type=='MESH' for o in scene.objects),'triangles':sum(sum(len(p.vertices)-2 for p in o.data.polygons) for o in scene.objects if o.type=='MESH'),'glb_bytes':(OUT/'cosmic-arena.glb').stat().st_size}
(OUT/'model-report.json').write_text(json.dumps(report,indent=2))
print('ARENA_REPORT',report)
