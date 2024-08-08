
import math
from math import exp, sqrt, pi
import matplotlib.pyplot as plt
from matplotlib import cm
import numpy

# erfcc and ncdf from http://stackoverflow.com/questions/809362/cumulative-normal-distribution-in-python
def erfcc(x):
  """Complementary error function."""
  z = abs(x)
  t = 1. / (1. + 0.5*z)
  r = t * exp(-z*z-1.26551223+t*(1.00002368+t*(.37409196+
    t*(.09678418+t*(-.18628806+t*(.27886807+
    t*(-1.13520398+t*(1.48851587+t*(-.82215223+
    t*.17087277)))))))))
  if (x >= 0.):
    return r
  else:
    return 2. - r

def ncdf(x):
  return 1. - 0.5*erfcc(x/(2**0.5))

def npdf(x):
  return exp(-x*x/2) / sqrt(2*pi)

def getCMean(lam, f, vs):
  return exp(-lam * vs) / (2 * lam * (1+f))

def getCVar(lam, f, vs):
  assert vs >= 0
  p = exp(-lam * vs)
  return p * (2 - p) / (4 * lam * lam * (1+f) * (1+f))

def getSumZValue(n, t, mean, var):
  assert var >= 0
  if var == 0:
    return float("inf")
  return (t - (n - 1) * mean) / sqrt((n-1) * var)

def getRHS(lam, n, t, f, vs):
  cmean = getCMean(lam, f, vs)
  cvar = getCVar(lam, f, vs)
  z = getSumZValue(n, t, cmean, cvar)
  numer = (1-ncdf(z)) * (1+f) - f
  denom = npdf(z)
  if denom == 0:
    res = float("inf") * numer
  else:
    res = sqrt((n-1) * cvar) * numer / denom
  return res


def binarySearchZero(f, xmin, xmax):
  while True:
    xmid = (xmin + xmax) / 2
    if xmid == xmin or xmid == xmax:
      return xmid
    fx = f(xmid)
    if fx < 0:
      xmin = xmid
    elif fx > 0 or math.isnan(fx):
      xmax = xmid
    else:
      return xmid

def findVstar(lam, n, t, f):
  maxvs = n*lam
  minvs = 0
  return binarySearchZero(lambda x: x - getRHS(lam, n, t, f, x), minvs, maxvs)


def contractResult(lam, n, c, t, f):
  vs = findVstar(lam, n, t, f)
  cmean = getCMean(lam, f, vs)
  cvar = getCVar(lam, f, vs)
  z = getSumZValue(n, t, cmean, cvar)
  success = 1-ncdf(z)
  pdf = npdf(z)
  profitIfSucceed = n*cmean - c + sqrt(n*cvar) * pdf / success
  profitIfFail = -f * (n*cmean - sqrt(n*cvar) * pdf / (1 - success))
  #profit = (t - c) * success - f * t * (1 - success)
  profit = profitIfSucceed * success + profitIfFail * (1 - success)
  return {'smean': n*cmean, 'svar': n*cvar, 'z': z, 'success': success, 'pdf': pdf, 'vs': vs, 'profit': profit}

def plotContract(lam, n, c, tvalues, fvalues, filename, field='profit', title=""):
  tvalues = list(tvalues)
  fvalues = list(fvalues)
  zvalues = [[(t, f, contractResult(lam, n, c, t, f)[field]) for t in tvalues] for f in fvalues]
  def getValues(i, f=lambda x:x):
    return [[f(zv[i]) for zv in zvs] for zvs in zvalues]
  maxt, maxf, maxz = max(sum(zvalues, []), key = lambda zv: zv[2])
  print("max t =", maxt, ", f =", maxf, ", z =", maxz)
  print("max result =", contractResult(lam, n, c, maxt, maxf))
  plt.close()
  fig = plt.figure()
  ax = fig.add_subplot(111)
  ax.set_title(title)
  ax.set_xlabel("T")
  ax.set_ylabel("F")
  levels = [float("-inf")]
  cs = ax.contourf(getValues(0), getValues(1), getValues(2, lambda x: max(-maxz/20, x)), 20, cmap=cm.bone, origin='lower')
  cbar = plt.colorbar(cs)
  plt.savefig(filename)

def DACProfit(lam, n, c, k, v, full=False):
  pPledge = exp(-lam*v)
  stdev = sqrt(n*pPledge*(1-pPledge))
  if stdev == 0: return float("nan")
  z = (k - n*pPledge) / stdev
  pPivotal = npdf(z) / stdev
  pSuccess = 1 - ncdf(z)
  profit = v * k * pPivotal - c * pSuccess
  if full:
    return {'profit': profit, 'pledge': pPledge, 'success': pSuccess}
  else:
    return profit

def optimizeDACProfit(lam, n, c, v):
  pPledge = exp(-lam*v)
  k = int(pPledge * n + 0.5)
  return DACProfit(lam, n, c, k, v)

def plotDAC(lam, n, c, kvalues, vvalues, filename):
  kvalues = list(kvalues)
  vvalues = list(vvalues)
  zvalues = [[(k, v, DACProfit(lam, n, c, k, v)) for k in kvalues] for v in vvalues]
  def getValues(i):
    return [[zv[i] for zv in zvs] for zvs in zvalues]

  def getProfit(tup):
    if math.isnan(tup[2]):
      return float("-inf")
    return tup[2]
  maxk, maxv, maxz = max(sum(zvalues, []), key = getProfit)
  print("max K =", maxk, ", V* =", maxv, ", profit =", maxz)
  print("max result =", DACProfit(lam, n, c, maxk, maxv, True))
  plt.close()
  fig = plt.figure()
  ax = fig.add_subplot(111)
  ax.set_title("Profit")
  ax.set_xlabel("K")
  ax.set_ylabel("V*")
  cs = ax.contourf(getValues(0), getValues(1), getValues(2), 20, cmap=cm.bone, origin='lower')
  cbar = plt.colorbar(cs)
  plt.savefig(filename)

def plotOptDAC(lam, n, c, vvalues, filename):
  vvalues = list(vvalues)
  yvalues = [optimizeDACProfit(lam, n, c, v) for v in vvalues]
  for i in range(len(yvalues)):
    if math.isnan(yvalues[i]):
      yvalues[i] = 0.0
  print("max profit = ", max(yvalues))
  plt.close()
  plt.plot(vvalues, yvalues)
  plt.savefig(filename)

def plotRHS(lam, n, t, f, xvalues, filename):
  xvalues = list(xvalues)
  yvalues = [getRHS(lam, n, t, f, x) for x in xvalues]
  plt.close()
  plt.plot(xvalues, yvalues)
  plt.plot(xvalues, xvalues)
  plt.ylim([0, 4 * max(xvalues)])
  plt.savefig(filename)


