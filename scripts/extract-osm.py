import osmium,sys,json,glob
path, target=sys.argv[1:3]
rels_to_find={305496,4289712,11341406,7719796,4289797,2396287,11344904,7719781,11799409,15085833,14900216,4289800,15083964,9987139,2962729,301617,2409338,7420265,11344897,12174616,300961,301616,9476599,14738977,19587363}
rels={}; ways={}; nodes={}
if len(sys.argv)>3:
 for filename in glob.glob(sys.argv[3]+'/*.json'):
  for e in json.load(open(filename))['elements']:
   typ=e['type']; k=e['id']; tags=e.get('tags',{})
   if typ=='node': nodes[k]=[e['lon'],e['lat'],tags.get('name','')]
   elif typ=='way': ways[k]=e['nodes']
   elif typ=='relation' and k in rels_to_find:
    rels[k]=[(m['type'][0],m['ref'],m['role']) for m in e['members']]
class Rel(osmium.SimpleHandler):
 def relation(self,r):
  if r.id in rels_to_find and r.id not in rels:
   rels[r.id]=[(m.type,m.ref,m.role) for m in r.members]
Rel().apply_file(path)
coast={}
needed_ways={id for members in rels.values() for kind,id,role in members if kind=='w'}
class Ways(osmium.SimpleHandler):
 def way(self,w):
  if w.id in needed_ways and w.id not in ways: ways[w.id]=[n.ref for n in w.nodes]
  if w.tags.get('natural')=='coastline':
   coast[w.id]=[n.ref for n in w.nodes]
Ways().apply_file(path)
needed_nodes={id for members in rels.values() for kind,id,role in members if kind=='n'}
needed_nodes|={id for way in list(ways.values())+list(coast.values()) for id in way}
class Nodes(osmium.SimpleHandler):
 def node(self,n):
  if n.id in needed_nodes and n.id not in nodes:
   nodes[n.id]=[n.location.lon,n.location.lat,n.tags.get('name','')]
Nodes().apply_file(path)
json.dump({'rels':rels,'ways':ways,'nodes':nodes,'coast':coast},open(target,'w'),ensure_ascii=False)
print('Saved',len(rels),len(ways),len(nodes),len(coast))
for k,mem in sorted(rels.items()):
 st=[nodes.get(id,['','','?'])[2] for kind,id,role in mem if kind=='n' and role.startswith('stop')]
 print(k,len(st), '|'.join(st))
